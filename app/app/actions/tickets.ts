'use server';

import { db } from '@/db';
import { tickets, ticketComments } from '@/db/schema';
import { requireInternalRole, canViewTicket } from '@/lib/auth/permissions';
import { generateTicketKey } from '@/lib/tickets/keys';
import { logAudit } from '@/lib/audit/log';
import {
  sendAgentReplyNotification,
  sendTicketStatusChangedNotification,
} from '@/lib/email/notifications';
import { getTicketById } from '@/lib/tickets/queries';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const ticketStatusSchema = z.enum(['NEW', 'OPEN', 'WAITING_ON_CUSTOMER', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
const ticketPrioritySchema = z.enum(['P1', 'P2', 'P3', 'P4']);
const ticketCategorySchema = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST']);

export async function updateTicketStatusAction(
  ticketId: string,
  status: string
) {
  const user = await requireInternalRole();
  const result = await canViewTicket(ticketId);
  
  const validatedStatus = ticketStatusSchema.parse(status);
  const oldStatus = result.ticket.status;

  if (validatedStatus === oldStatus) {
    return;
  }

  await db
    .update(tickets)
    .set({ status: validatedStatus, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  await logAudit({
    userId: user.id,
    orgId: result.ticket.orgId,
    ticketId,
    action: 'TICKET_STATUS_CHANGED',
    details: JSON.stringify({ oldStatus, newStatus: validatedStatus }),
  });

  const fullTicket = await getTicketById(ticketId);
  if (fullTicket) {
    await sendTicketStatusChangedNotification(fullTicket, oldStatus, validatedStatus);
  }

  revalidatePath(`/app/tickets/${ticketId}`);
  revalidatePath('/app');
}

export async function assignTicketAction(
  ticketId: string,
  assigneeId: string | null
) {
  const user = await requireInternalRole();
  const result = await canViewTicket(ticketId);

  await db
    .update(tickets)
    .set({ assigneeId, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  await logAudit({
    userId: user.id,
    orgId: result.ticket.orgId,
    ticketId,
    action: 'TICKET_ASSIGNED',
    details: JSON.stringify({ assigneeId }),
  });

  revalidatePath(`/app/tickets/${ticketId}`);
  revalidatePath('/app');
}

export async function updateTicketPriorityAction(
  ticketId: string,
  priority: string
) {
  const user = await requireInternalRole();
  const result = await canViewTicket(ticketId);

  const validatedPriority = ticketPrioritySchema.parse(priority);

  await db
    .update(tickets)
    .set({ priority: validatedPriority, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  await logAudit({
    userId: user.id,
    orgId: result.ticket.orgId,
    ticketId,
    action: 'TICKET_PRIORITY_CHANGED',
    details: JSON.stringify({ priority: validatedPriority }),
  });

  revalidatePath(`/app/tickets/${ticketId}`);
  revalidatePath('/app');
}

export async function addTicketCommentAction(
  ticketId: string,
  content: string,
  isInternal: boolean
) {
  const user = await requireInternalRole();
  const result = await canViewTicket(ticketId);

  const [comment] = await db
    .insert(ticketComments)
    .values({
      ticketId,
      userId: user.id,
      content,
      isInternal,
    })
    .returning();

  await logAudit({
    userId: user.id,
    orgId: result.ticket.orgId,
    ticketId,
    action: 'TICKET_COMMENT_ADDED',
    details: JSON.stringify({ isInternal }),
  });

  // Send email notification if public comment from agent
  if (!isInternal && comment) {
    const ticket = await getTicketById(ticketId);
    if (ticket) {
      const ticketUrl = `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'}/app/tickets/${ticketId}`;
      await sendAgentReplyNotification(
        ticket,
        {
          ...comment,
          user: { name: user.name, email: user.email },
        },
        ticketUrl
      );
    }
  }

  revalidatePath(`/app/tickets/${ticketId}`);
}

export async function createTicketAction(data: {
  orgId: string;
  subject: string;
  description: string;
  priority: string;
  category: string;
  assigneeId?: string | null;
  requesterEmail?: string | null;
}) {
  const user = await requireInternalRole();

  const validatedPriority = ticketPrioritySchema.parse(data.priority);
  const validatedCategory = ticketCategorySchema.parse(data.category);

  const subject = z.string().min(1).parse(data.subject);
  const description = z.string().min(1).parse(data.description);
  const orgId = z.string().uuid().parse(data.orgId);

  let requesterEmail: string | null = null;
  if (data.requesterEmail && data.requesterEmail.trim()) {
    requesterEmail = z.string().email().parse(data.requesterEmail.trim());
  }

  let assigneeId: string | null = null;
  if (data.assigneeId) {
    assigneeId = z.string().uuid().parse(data.assigneeId);
  }

  const ticketKey = await generateTicketKey();

  const [ticket] = await db
    .insert(tickets)
    .values({
      key: ticketKey,
      orgId,
      subject,
      description,
      priority: validatedPriority,
      category: validatedCategory,
      status: 'NEW',
      requesterEmail,
      assigneeId,
    })
    .returning();

  await logAudit({
    userId: user.id,
    orgId,
    ticketId: ticket.id,
    action: 'TICKET_CREATED',
    details: JSON.stringify({ key: ticketKey }),
  });

  revalidatePath('/app');
  return { ticketId: ticket.id, error: null };
}
