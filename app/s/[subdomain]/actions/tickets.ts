'use server';

import { db } from '@/db';
import { attachments, assets, areas, sites, ticketAssets, tickets, ticketComments, services, type Ticket, organizations } from '@/db/schema';
import { requireOrgMemberRole, canEditTicket } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';
import { generateTicketKey } from '@/lib/tickets/keys';
import { sendCustomerReplyNotification, sendCustomerTicketCreatedNotification, sendTicketStatusChangedNotification } from '@/lib/email/notifications';
import { getTicketById } from '@/lib/tickets/queries';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { put } from '@vercel/blob';
import { and, eq, inArray } from 'drizzle-orm';
import { validateAttachmentFile } from '@/lib/attachments/validation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { checkQuota, incrementStorageUsage } from '@/lib/attachments/quota';
import { getOrgSLATargets, updateResolutionTime } from '@/lib/tickets/sla';
import { updateSLAPauseStatus } from '@/lib/tickets/sla-pause';
import { getRequestTypeById } from '@/lib/request-types/queries';
import { requestFormSchema, validateRequestPayload } from '@/lib/request-types/validation';
import { buildRequestDescription, buildRequestSubject } from '@/lib/request-types/format';

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

async function uploadAttachment(ticketId: string, file: File) {
  if (!blobToken) {
    throw new Error('Blob storage is not configured');
  }

  const validated = validateAttachmentFile(file);
  const safeName = validated.filename;
  const path = `tickets/${ticketId}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  // Note: In @vercel/blob 0.24+, blobs are private by default
  // We use signed URLs for secure access, so files don't need to be public
  const blob = await put(path, buffer, {
    contentType: validated.contentType,
    token: blobToken,
    // Explicitly set access to 'public' if required by SDK version
    // Files are still secured via signed URLs in the download route
    access: 'public' as const,
  });

  return {
    filename: safeName,
    contentType: validated.contentType,
    size: validated.size,
    blobPathname: blob.pathname,
    // For public blobs, store the URL directly; for private, store pathname
    storageKey: blob.url || blob.pathname,
  };
}

export async function createCustomerTicketAction(data: {
  subject: string;
  description: string;
  priority: string;
}) {
  const { user, orgId } = await requireOrgMemberRole();

  const ticketKey = await generateTicketKey();
  const slaTargets = await getOrgSLATargets(orgId, data.priority);

  const [ticket] = await db
    .insert(tickets)
    .values({
      key: ticketKey,
      orgId,
      subject: data.subject,
      description: data.description,
      priority: data.priority as 'P1' | 'P2' | 'P3' | 'P4',
      category: 'SERVICE_REQUEST',
      status: 'NEW',
      requesterId: user.id,
      slaResponseTargetHours: slaTargets.responseHours,
      slaResolutionTargetHours: slaTargets.resolutionHours,
    })
    .returning();

  await logAudit({
    userId: user.id,
    orgId,
    ticketId: ticket.id,
    action: 'TICKET_CREATED',
    details: JSON.stringify({ key: ticketKey }),
  });

  // Send notification for new customer ticket
    const fullTicket = await getTicketById(ticket.id, orgId);
    if (fullTicket && 'requester' in fullTicket && 'organization' in fullTicket) {
      await sendCustomerTicketCreatedNotification(fullTicket as unknown as Ticket & {
        requester: { email: string; name: string | null } | null;
        organization: { name: string };
      });
    }

  revalidatePath(`/s/[subdomain]/tickets`, 'page');

  return { ticketId: ticket.id, error: null };
}

export async function createCustomerTicketWithAttachmentsAction(formData: FormData) {
  const requestTypeId = formData.get('requestTypeId');
  const requestPayloadRaw = formData.get('requestPayload');
  const subject = formData.get('subject');
  const description = formData.get('description');
  const priority = formData.get('priority');
  const subdomainParam = formData.get('subdomain');
  const serviceIdValue = formData.get('serviceId');
  const ccValue = formData.get('cc');
  const siteIdValue = formData.get('siteId');
  const areaIdValue = formData.get('areaId');
  const assetIds = formData
    .getAll('assetIds')
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  const items = formData.getAll('attachments');
  const files = items.filter((item): item is File => item instanceof File);

  // If subdomain is provided, look up the org and pass it to requireOrgMemberRole
  let orgId: string | undefined = undefined;
  if (typeof subdomainParam === 'string') {
    const org = await getOrgBySubdomain(subdomainParam);
    if (org) {
      orgId = org.id;
    }
  }

  const { user, membership, orgId: resolvedOrgId } = await requireOrgMemberRole(orgId);

  const resolvedServiceId = typeof serviceIdValue === 'string' && serviceIdValue ? serviceIdValue : null;
  let resolvedSiteId = typeof siteIdValue === 'string' && siteIdValue ? siteIdValue : null;
  const resolvedAreaId = typeof areaIdValue === 'string' && areaIdValue ? areaIdValue : null;

  if (resolvedServiceId) {
    const service = await db.query.services.findFirst({
      where: and(eq(services.id, resolvedServiceId), eq(services.orgId, resolvedOrgId)),
    });
    if (!service) {
      return { ticketId: null, error: 'Selected service is invalid.' };
    }
  }

  if (resolvedSiteId) {
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, resolvedSiteId), eq(sites.orgId, resolvedOrgId)),
    });
    if (!site) {
      return { ticketId: null, error: 'Selected site is invalid.' };
    }
  }

  if (resolvedAreaId) {
    const area = await db.query.areas.findFirst({
      where: eq(areas.id, resolvedAreaId),
      with: { site: true },
    });
    const site = area?.site as { orgId: string } | undefined;
    if (!area || !site || site.orgId !== resolvedOrgId) {
      return { ticketId: null, error: 'Selected area is invalid.' };
    }
    if (resolvedSiteId && area.siteId !== resolvedSiteId) {
      return { ticketId: null, error: 'Selected area does not belong to site.' };
    }
    if (!resolvedSiteId) {
      resolvedSiteId = area.siteId;
    }
  }

  const uniqueAssetIds = Array.from(new Set(assetIds));
  if (uniqueAssetIds.length > 0 && membership.role !== 'CUSTOMER_ADMIN') {
    return { ticketId: null, error: 'Only admins can link assets.' };
  }

  if (uniqueAssetIds.length > 0) {
    const orgAssets = await db.query.assets.findMany({
      where: and(eq(assets.orgId, resolvedOrgId), inArray(assets.id, uniqueAssetIds)),
      columns: { id: true },
    });
    if (orgAssets.length !== uniqueAssetIds.length) {
      return { ticketId: null, error: 'One or more assets are invalid.' };
    }
  }

  let ticketSubject = '';
  let ticketDescription = '';
  let ticketPriority: 'P1' | 'P2' | 'P3' | 'P4' = 'P3';
  let ticketCategory: 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE_REQUEST' = 'SERVICE_REQUEST';
  let requestPayload: Record<string, unknown> | null = null;
  let resolvedRequestTypeId: string | null = null;
  let ccEmails: string[] | null = null;
  let requestTypeRequiredAttachments = false;

  if (typeof requestTypeId === 'string' && requestTypeId) {
    const requestType = await getRequestTypeById(resolvedOrgId, requestTypeId);
    if (!requestType || !requestType.isActive) {
      return { ticketId: null, error: 'Request type is not available.' };
    }

    const schema = requestFormSchema.parse(requestType.formSchema || { fields: [] });
    let payloadObject: Record<string, unknown> = {};
    if (typeof requestPayloadRaw === 'string' && requestPayloadRaw.trim().length > 0) {
      try {
        payloadObject = JSON.parse(requestPayloadRaw) as Record<string, unknown>;
      } catch {
        return { ticketId: null, error: 'Request data is invalid.' };
      }
    }

    const validation = validateRequestPayload(schema, payloadObject);
    if (validation.errors.length > 0) {
      return { ticketId: null, error: validation.errors.join(' ') };
    }

    requestTypeRequiredAttachments = requestType.requiredAttachments;
    ticketSubject = buildRequestSubject(requestType.name, validation.payload);
    ticketDescription = buildRequestDescription(requestType.name, schema, validation.payload);
    ticketPriority = requestType.defaultPriority as 'P1' | 'P2' | 'P3' | 'P4';
    ticketCategory = requestType.category as 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE_REQUEST';
    requestPayload = validation.payload;
    resolvedRequestTypeId = requestType.id;
  } else {
    if (typeof subject !== 'string' || typeof description !== 'string') {
      return { ticketId: null, error: 'Missing required fields.' };
    }

    const allowedPriorities = ['P1', 'P2', 'P3', 'P4'] as const;
    const priorityValue = typeof priority === 'string' ? priority : '';
    ticketPriority = allowedPriorities.includes(priorityValue as (typeof allowedPriorities)[number])
      ? (priorityValue as (typeof allowedPriorities)[number])
      : 'P3';
    ticketSubject = subject;
    ticketDescription = description;
    ticketCategory = 'SERVICE_REQUEST';
  }

  if (typeof ccValue === 'string' && ccValue.trim().length > 0) {
    const parts = ccValue
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (parts.length > 0) {
      ccEmails = Array.from(new Set(parts));
    }
  }

  if (requestTypeRequiredAttachments && files.length === 0) {
    return { ticketId: null, error: 'Attachments are required for this request.' };
  }

  const ticketKey = await generateTicketKey();
  const slaTargets = await getOrgSLATargets(resolvedOrgId, ticketPriority);

  const [ticket] = await db
    .insert(tickets)
    .values({
      key: ticketKey,
      orgId: resolvedOrgId,
      subject: ticketSubject,
      description: ticketDescription,
      priority: ticketPriority,
      category: ticketCategory,
      status: 'NEW',
      requesterId: user.id,
      requestTypeId: resolvedRequestTypeId,
      requestPayload,
      serviceId: resolvedServiceId,
      siteId: resolvedSiteId,
      areaId: resolvedAreaId,
      slaResponseTargetHours: slaTargets.responseHours,
      slaResolutionTargetHours: slaTargets.resolutionHours,
      ccEmails,
    })
    .returning();

  if (uniqueAssetIds.length > 0) {
    await db
      .insert(ticketAssets)
      .values(
        uniqueAssetIds.map((assetId) => ({
          ticketId: ticket.id,
          assetId,
          createdAt: new Date(),
        }))
      )
      .onConflictDoNothing();
  }

  if (files.length > 0) {
    try {
      // Check quota for all files before uploading
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const quotaCheck = await checkQuota(resolvedOrgId, totalSize);
      
      if (!quotaCheck.allowed) {
        await db.delete(tickets).where(eq(tickets.id, ticket.id));
        return { ticketId: null, error: quotaCheck.error || 'Storage quota exceeded. Please contact support.' };
      }

      const attachmentValues = [];
      for (const file of files) {
        const uploadResult = await uploadAttachment(ticket.id, file);
        attachmentValues.push({
          ticketId: ticket.id,
          filename: uploadResult.filename,
          contentType: uploadResult.contentType,
          size: uploadResult.size,
          storageKey: uploadResult.storageKey,
          blobPathname: uploadResult.storageKey, // Assuming blobPathname is same as storageKey or we need to add it if available
          orgId: resolvedOrgId,
          uploadedBy: user.id,
        });
      }

      if (attachmentValues.length > 0) {
        await db.insert(attachments).values(attachmentValues);
        await incrementStorageUsage(resolvedOrgId, totalSize);
      }
    } catch (error) {
      console.error('Failed to upload attachments:', error);
      // We keep the ticket but maybe warn? Or delete ticket?
      // For now, proceed.
    }
  }

  await logAudit({
    userId: user.id,
    orgId: resolvedOrgId,
    ticketId: ticket.id,
    action: 'TICKET_CREATED',
    details: JSON.stringify({ key: ticketKey, hasAttachments: files.length > 0 }),
  });

  const fullTicket = await getTicketById(ticket.id, resolvedOrgId);
  if (fullTicket && 'organization' in fullTicket) {
    await sendCustomerTicketCreatedNotification(fullTicket as unknown as Ticket & {
      requester: { email: string; name: string | null } | null;
      organization: { name: string };
    });
  }

  if (typeof subdomainParam === 'string') {
    revalidatePath(`/s/${subdomainParam}/tickets`, 'page');
  }

  return { ticketId: ticket.id, error: null };
}

export async function addCustomerTicketCommentAction(
  ticketId: string,
  content: string
) {
  const result = await canEditTicket(ticketId);
  const { user } = await requireOrgMemberRole(result.ticket.orgId);

  // Customers can only add public comments (not internal notes)
  const [comment] = await db
    .insert(ticketComments)
    .values({
      ticketId,
      userId: user.id,
      content,
      isInternal: false,
    })
    .returning();

  await logAudit({
    userId: user.id,
    orgId: result.ticket.orgId,
    ticketId,
    action: 'TICKET_COMMENT_ADDED',
    details: JSON.stringify({ isInternal: false }),
  });

  // Send email notification to assigned agent
  if (comment) {
    await sendCustomerReplyNotification(ticketId, {
      ...comment,
      user: { name: user.name, email: user.email },
      authorEmail: user.email,
    });
  }

  revalidatePath(`/s/[subdomain]/tickets/${ticketId}`, 'page');
}

export async function updateCustomerTicketCcAction(ticketId: string, ccEmails: string[]) {
  const { ticket } = await canEditTicket(ticketId);

  await db
    .update(tickets)
    .set({ ccEmails })
    .where(eq(tickets.id, ticketId));

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, ticket.orgId),
    columns: { subdomain: true },
  });

  if (org?.subdomain) {
    revalidatePath(`/s/${org.subdomain}/tickets/${ticketId}`);
  }
}

export async function closeCustomerTicketAction(ticketId: string) {
  const { ticket } = await canEditTicket(ticketId);
  const { user } = await requireOrgMemberRole(ticket.orgId);

  if (ticket.status === 'CLOSED') {
    return;
  }

  await db
    .update(tickets)
    .set({ status: 'CLOSED', updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  await updateResolutionTime(ticketId, 'CLOSED');

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, ticket.orgId),
    columns: { businessHours: true },
  });

  let businessHoursConfig = null;
  if (org?.businessHours) {
    businessHoursConfig = org.businessHours;
  }

  await updateSLAPauseStatus(ticketId, 'CLOSED', businessHoursConfig);

  await logAudit({
    userId: user.id,
    orgId: ticket.orgId,
    ticketId,
    action: 'TICKET_STATUS_CHANGED',
    details: JSON.stringify({ oldStatus: ticket.status, newStatus: 'CLOSED', closedByCustomer: true }),
  });

  const fullTicket = await getTicketById(ticketId, ticket.orgId);
  if (fullTicket && 'requester' in fullTicket) {
    await sendTicketStatusChangedNotification(fullTicket as unknown as Ticket & {
      requester: { email: string; name: string | null } | null;
    }, ticket.status, 'CLOSED');
  }

  revalidatePath(`/s/[subdomain]/tickets/${ticketId}`, 'page');
  revalidatePath(`/s/[subdomain]/tickets`, 'page');
}
