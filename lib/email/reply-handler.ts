/**
 * Email reply handler
 * 
 * Handles incoming email replies to tickets:
 * - Matches email to existing ticket
 * - Creates comment from email
 * - Handles attachments
 * - Updates ticket status
 */

import { db } from '@/db';
import { tickets, ticketComments, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { matchEmailToTicket as matchEmailToTicketByThreading, generateMessageId } from './threading';
import { getTicketById } from '@/lib/tickets/queries';

export interface InboundEmail {
  from: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    data: Buffer;
  }>;
}

/**
 * Extract email address from "Name <email@example.com>" format
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
  return match ? match[1] : from.trim();
}

/**
 * Match email to an existing ticket
 */
export async function matchEmailToTicket(email: InboundEmail): Promise<typeof tickets.$inferSelect | null> {
  return matchEmailToTicketByThreading({
    subject: email.subject,
    messageId: email.messageId,
    inReplyTo: email.inReplyTo,
    references: email.references,
  });
}

/**
 * Create a comment from an email reply
 * 
 * @param ticketId - The ticket ID to add the comment to
 * @param email - The inbound email data
 * @returns The created comment
 */
export async function createCommentFromEmail(
  ticketId: string,
  email: InboundEmail
): Promise<typeof ticketComments.$inferSelect> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }

  // Extract email address
  const emailAddress = extractEmailAddress(email.from);

  // Find user by email (if exists)
  const user = await db.query.users.findFirst({
    where: eq(users.email, emailAddress),
  });

  // Use text body, fallback to HTML if no text
  const content = email.textBody || (email.htmlBody ? stripHtml(email.htmlBody) : '');

  // Generate message ID if not provided
  const messageId = email.messageId || generateMessageId(ticketId, 'new');

  // Create comment
  const [comment] = await db
    .insert(ticketComments)
    .values({
      ticketId,
      userId: user?.id || null,
      authorEmail: emailAddress,
      content,
      isInternal: false, // Email replies from customers are always public
      messageId,
      inReplyTo: email.inReplyTo || null,
      references: email.references || null,
    })
    .returning();

  // Update ticket status if it's waiting on customer
  // When customer replies, move from WAITING_ON_CUSTOMER to OPEN
  if (ticket.status === 'WAITING_ON_CUSTOMER') {
    await db
      .update(tickets)
      .set({
        status: 'OPEN',
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));
  } else {
    // Just update the timestamp
    await db
      .update(tickets)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));
  }

  return comment;
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Process an inbound email: match to ticket and create comment
 * 
 * @param email - The inbound email
 * @returns Object with ticket and comment, or null if no ticket matched
 */
export async function processEmailReply(
  email: InboundEmail
): Promise<{
  ticket: typeof tickets.$inferSelect;
  comment: typeof ticketComments.$inferSelect;
  isNewTicket: boolean;
} | null> {
  // Try to match email to existing ticket
  const ticket = await matchEmailToTicket(email);

  if (!ticket) {
    return null; // No match found, should create new ticket
  }

  // Create comment from email
  const comment = await createCommentFromEmail(ticket.id, email);

  return {
    ticket,
    comment,
    isNewTicket: false,
  };
}

