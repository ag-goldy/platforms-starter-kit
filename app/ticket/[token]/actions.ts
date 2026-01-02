'use server';

import { db } from '@/db';
import { ticketComments } from '@/db/schema';
import { validateTicketToken } from '@/lib/tickets/magic-links';
import { getTicketById } from '@/lib/tickets/queries';
import { revalidatePath } from 'next/cache';
import { sendCustomerReplyNotification } from '@/lib/email/notifications';

export async function addPublicTicketCommentAction(token: string, content: string) {
  // Validate token first
  const tokenData = await validateTicketToken(token);

  if (!tokenData) {
    throw new Error('Invalid or expired token');
  }

  // Get ticket to verify email matches
  const ticket = await getTicketById(tokenData.ticketId);

  if (!ticket || ticket.requesterEmail !== tokenData.email) {
    throw new Error('Invalid ticket access');
  }

  // Add comment (public, from email)
  const [comment] = await db.insert(ticketComments).values({
    ticketId: ticket.id,
    authorEmail: tokenData.email,
    content,
    isInternal: false,
  }).returning();

  if (comment) {
    await sendCustomerReplyNotification(ticket.id, {
      ...comment,
      user: null,
      authorEmail: tokenData.email,
    });
  }

  revalidatePath(`/ticket/${token}`, 'page');
}
