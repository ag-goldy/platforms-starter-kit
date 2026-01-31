'use server';

import { db } from '@/db';
import { ticketComments } from '@/db/schema';
import { consumeTicketToken, createTicketToken } from '@/lib/tickets/magic-links';
import { getTicketById } from '@/lib/tickets/queries';
import { sendCustomerReplyNotification } from '@/lib/email/notifications';
import { headers } from 'next/headers';
import { getClientIP } from '@/lib/rate-limit';

export async function addPublicTicketCommentAction(token: string, content: string) {
  // Validate token first
  const headersList = await headers();
  const ip = getClientIP(headersList);
  const tokenData = await consumeTicketToken({
    token,
    purpose: 'REPLY',
    usedIp: ip,
  });

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

  const nextToken = await createTicketToken({
    ticketId: ticket.id,
    email: tokenData.email,
    purpose: 'REPLY',
    createdIp: ip,
  });

  return { replyToken: nextToken };
}

