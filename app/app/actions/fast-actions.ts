'use server';

import { requireInternalRole } from '@/lib/auth/permissions';
import { assignTicketAction, updateTicketStatusAction, addTicketCommentAction } from './tickets';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { tickets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { canViewTicket } from '@/lib/auth/permissions';

/**
 * Assign ticket to current user
 */
export async function assignToMeAction(ticketId: string) {
  const user = await requireInternalRole();
  
  // Verify user can view ticket
  await canViewTicket(ticketId);
  
  await assignTicketAction(ticketId, user.id);
  revalidatePath('/app');
  revalidatePath(`/app/tickets/${ticketId}`);
  
  return { success: true };
}

/**
 * Reply and set status to Waiting on Customer
 */
export async function replyAndWaitingAction(ticketId: string, comment: string) {
  await requireInternalRole();
  
  // Verify user can view ticket
  await canViewTicket(ticketId);
  
  // Add comment
  await addTicketCommentAction(ticketId, comment, false);
  
  // Set status to WAITING_ON_CUSTOMER
  await updateTicketStatusAction(ticketId, 'WAITING_ON_CUSTOMER');
  
  revalidatePath('/app');
  revalidatePath(`/app/tickets/${ticketId}`);
  
  return { success: true };
}

/**
 * Close ticket and send CSAT if available
 */
export async function closeAndSendCSATAction(ticketId: string) {
  await requireInternalRole();
  
  // Verify user can view ticket
  await canViewTicket(ticketId);
  
  // Get ticket to check if CSAT is configured
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      orgId: true,
    },
  });
  
  if (!ticket) {
    throw new Error('Ticket not found');
  }
  
  // Close the ticket
  await updateTicketStatusAction(ticketId, 'CLOSED');
  
  // TODO: Send CSAT email if configured for the organization
  // For now, just close the ticket
  
  revalidatePath('/app');
  revalidatePath(`/app/tickets/${ticketId}`);
  
  return { success: true };
}
