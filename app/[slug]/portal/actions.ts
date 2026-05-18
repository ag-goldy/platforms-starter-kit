'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  assets,
  requestTypes,
  ticketAssets,
  ticketComments,
  tickets,
} from '@/db/schema';
import { generateTicketKey } from '@/lib/tickets/keys';
import { getOrgSLATargets } from '@/lib/tickets/sla';
import { logAudit } from '@/lib/audit/log';
import { getTicketById } from '@/lib/tickets/queries';
import { sendCustomerReplyNotification, sendCustomerTicketCreatedNotification } from '@/lib/email/notifications';
import { createNotification } from '@/lib/notifications/service';
import { publishRealtimeEvent } from '@/lib/realtime/broadcast';
import { buildRequestDescription, buildRequestSubject } from '@/lib/request-types/format';
import { requestFormSchema, validateRequestPayload } from '@/lib/request-types/validation';
import { requirePortalAccess } from '@/lib/portal/access';
import { triggerOnCommentAdd, triggerOnTicketCreate } from '@/lib/automation/rules';
import { assertTicketMutable, reopenTicket } from '@/lib/tickets/lifecycle';
import type { Ticket } from '@/db/schema';

type ActionState = {
  error?: string | null;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function createPortalTicketAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const slug = readString(formData, 'slug');
  const access = await requirePortalAccess(slug);
  if (!access) return { error: 'Organization not found.' };

  const requestTypeId = readString(formData, 'requestTypeId');
  const subject = readString(formData, 'subject');
  const description = readString(formData, 'description');
  const assetId = readString(formData, 'assetId');
  const priorityInput = readString(formData, 'priority');
  const allowedPriorities = ['P2', 'P3', 'P4'] as const;
  const priority = allowedPriorities.includes(priorityInput as (typeof allowedPriorities)[number])
    ? (priorityInput as (typeof allowedPriorities)[number])
    : 'P3';

  let ticketSubject = subject;
  let ticketDescription = description;
  let resolvedRequestTypeId: string | null = null;
  let category: 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE_REQUEST' = 'SERVICE_REQUEST';
  let requestPayload: Record<string, unknown> | null = null;

  if (requestTypeId) {
    const requestType = await db.query.requestTypes.findFirst({
      where: and(
        eq(requestTypes.id, requestTypeId),
        eq(requestTypes.orgId, access.org.id),
        eq(requestTypes.isActive, true)
      ),
    });

    if (!requestType) {
      return { error: 'Selected request type is not available.' };
    }

    const schema = requestFormSchema.parse(requestType.formSchema || { fields: [] });
    const rawPayload: Record<string, unknown> = {};

    for (const field of schema.fields) {
      if (field.type === 'fileHint') continue;
      if (field.type === 'checkbox') {
        rawPayload[field.id] = formData.get(field.id) === 'on';
      } else if (field.type === 'multiselect') {
        rawPayload[field.id] = formData.getAll(field.id).filter((value): value is string => typeof value === 'string');
      } else {
        rawPayload[field.id] = readString(formData, field.id);
      }
    }

    const validation = validateRequestPayload(schema, rawPayload);
    if (validation.errors.length > 0) {
      return { error: validation.errors.join(' ') };
    }

    ticketSubject = subject || buildRequestSubject(requestType.name, validation.payload);
    ticketDescription = description || buildRequestDescription(requestType.name, schema, validation.payload);
    resolvedRequestTypeId = requestType.id;
    category = requestType.category as 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE_REQUEST';
    requestPayload = validation.payload;
  }

  if (ticketSubject.length < 3 || ticketDescription.length < 10) {
    return { error: 'Add a subject and a description with enough detail.' };
  }

  let linkedAssetId: string | null = null;
  if (assetId) {
    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.orgId, access.org.id)),
      columns: { id: true },
    });
    if (!asset) {
      return { error: 'Selected asset is not available.' };
    }
    linkedAssetId = asset.id;
  }

  const ticketKey = await generateTicketKey(access.org.id);
  const slaTargets = await getOrgSLATargets(access.org.id, priority);

  const [ticket] = await db
    .insert(tickets)
    .values({
      key: ticketKey,
      orgId: access.org.id,
      subject: ticketSubject,
      description: ticketDescription,
      priority,
      category,
      status: 'NEW',
      requesterId: access.user.id,
      requestTypeId: resolvedRequestTypeId,
      requestPayload,
      slaResponseTargetHours: slaTargets.responseHours,
      slaResolutionTargetHours: slaTargets.resolutionHours,
    })
    .returning();

  if (linkedAssetId) {
    await db
      .insert(ticketAssets)
      .values({
        ticketId: ticket.id,
        assetId: linkedAssetId,
      })
      .onConflictDoNothing();
  }

  await logAudit({
    orgId: access.org.id,
    actorId: access.user.id,
    action: 'TICKET_CREATED',
    resource: 'ticket',
    resourceId: ticket.id,
    details: { key: ticketKey, source: 'portal' },
  });

  await triggerOnTicketCreate(ticket, access.user.id);

  await publishRealtimeEvent({
    orgId: access.org.id,
    channel: 'tickets',
    event: 'ticket.created',
    data: {
      ticketId: ticket.id,
      ticketKey: ticket.key,
      subject: ticket.subject,
      requesterId: access.user.id,
    },
  }).catch((error) => {
    console.error('[Realtime] Failed to broadcast ticket.created:', error);
  });

  await createNotification({
    userId: access.user.id,
    type: 'TICKET_CREATED',
    title: `Request ${ticket.key} received`,
    message: ticket.subject,
    data: {
      ticketId: ticket.id,
      ticketKey: ticket.key,
      orgId: access.org.id,
    },
    link: `/${slug}/portal/tickets/${ticket.id}`,
  });

  const fullTicket = await getTicketById(ticket.id, access.org.id);
  if (fullTicket && 'organization' in fullTicket) {
    await sendCustomerTicketCreatedNotification(fullTicket as unknown as Ticket & {
      requester: { email: string; name: string | null } | null;
      organization: { name: string };
    });
  }

  revalidatePath(`/${slug}/portal`);
  revalidatePath(`/${slug}/portal/tickets`);
  redirect(`/${slug}/portal/tickets/${ticket.id}`);
}

export async function addPortalTicketReplyAction(formData: FormData) {
  const slug = readString(formData, 'slug');
  const ticketId = readString(formData, 'ticketId');
  const content = readString(formData, 'content');

  if (content.length < 2) {
    return;
  }

  const access = await requirePortalAccess(slug);
  if (!access) return;

  const ticket = await db.query.tickets.findFirst({
    where: and(
      eq(tickets.id, ticketId),
      eq(tickets.orgId, access.org.id),
      eq(tickets.requesterId, access.user.id)
    ),
  });

  if (!ticket) {
    return;
  }

  assertTicketMutable(ticket);
  const lifecycleTicket = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
    ? await reopenTicket({
      ticketId,
      orgId: access.org.id,
      actor: { type: 'customer', userId: access.user.id },
      reason: 'Customer replied after resolution.',
    })
    : ticket;

  const [comment] = await db
    .insert(ticketComments)
    .values({
      ticketId,
      userId: access.user.id,
      content,
      isInternal: false,
    })
    .returning();

  await logAudit({
    orgId: access.org.id,
    actorId: access.user.id,
    action: 'TICKET_COMMENT_ADDED',
    resource: 'ticket',
    resourceId: ticketId,
    details: { source: 'portal' },
  });

  await triggerOnCommentAdd(lifecycleTicket as Ticket, access.user.id);

  await sendCustomerReplyNotification(ticket.id, {
    ...comment,
    user: { name: access.user.name || null, email: access.user.email || '' },
    authorEmail: null,
  });

  await createNotification({
    userId: access.user.id,
    type: 'TICKET_COMMENTED',
    title: `Reply added to ${ticket.key}`,
    message: content.slice(0, 160),
    data: {
      ticketId,
      ticketKey: ticket.key,
      commentId: comment.id,
      orgId: access.org.id,
    },
    link: `/${slug}/portal/tickets/${ticketId}`,
  });

  await publishRealtimeEvent({
    orgId: access.org.id,
    channel: 'tickets',
    event: 'ticket.replied',
    data: {
      ticketId,
      ticketKey: ticket.key,
      commentId: comment.id,
      userId: access.user.id,
    },
  }).catch((error) => {
    console.error('[Realtime] Failed to broadcast ticket.replied:', error);
  });

  revalidatePath(`/${slug}/portal/tickets/${ticketId}`);
  revalidatePath(`/${slug}/portal/tickets`);
}

export async function getPortalRequestOptions(orgId: string) {
  const [types, orgAssets] = await Promise.all([
    db.query.requestTypes.findMany({
      where: and(eq(requestTypes.orgId, orgId), eq(requestTypes.isActive, true)),
      orderBy: [asc(requestTypes.name)],
    }),
    db.query.assets.findMany({
      where: and(eq(assets.orgId, orgId), eq(assets.archived, false)),
      orderBy: (table, { asc }) => [asc(table.name)],
      limit: 100,
    }),
  ]);

  return { requestTypes: types, assets: orgAssets };
}
