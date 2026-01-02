'use server';

import { db } from '@/db';
import { tickets, ticketComments } from '@/db/schema';
import { requireOrgMemberRole, canEditTicket } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';
import { generateTicketKey } from '@/lib/tickets/keys';
import { sendCustomerReplyNotification, sendCustomerTicketCreatedNotification } from '@/lib/email/notifications';
import { getTicketById } from '@/lib/tickets/queries';
import { revalidatePath } from 'next/cache';

export async function createCustomerTicketAction(data: {
  orgId: string;
  subject: string;
  description: string;
  priority: string;
}) {
  const { user } = await requireOrgMemberRole(data.orgId);

  const ticketKey = await generateTicketKey();

  const [ticket] = await db
    .insert(tickets)
    .values({
      key: ticketKey,
      orgId: data.orgId,
      subject: data.subject,
      description: data.description,
      priority: data.priority as 'P1' | 'P2' | 'P3' | 'P4',
      category: 'SERVICE_REQUEST',
      status: 'NEW',
      requesterId: user.id,
    })
    .returning();

  await logAudit({
    userId: user.id,
    orgId: data.orgId,
    ticketId: ticket.id,
    action: 'TICKET_CREATED',
    details: JSON.stringify({ key: ticketKey }),
  });

  // Send notification for new customer ticket
  const fullTicket = await getTicketById(ticket.id);
  if (fullTicket) {
    await sendCustomerTicketCreatedNotification(fullTicket);
  }

  revalidatePath(`/s/[subdomain]/tickets`, 'page');

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
