/**
 * Email threading utilities
 * 
 * Handles matching incoming emails to existing tickets based on:
 * - Ticket key in subject line (e.g., "Re: [AGR-2024-000123] Issue")
 * - Message-ID references
 * - In-Reply-To headers
 */

import { db } from '@/db';
import { tickets, ticketComments } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface EmailHeaders {
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  subject?: string;
}

/**
 * Extract ticket key from email subject
 * Matches patterns like:
 * - "Re: [AGR-2024-000123] Issue"
 * - "Fwd: [AGR-2024-000123] Original subject"
 * - "[AGR-2024-000123]"
 */
export function extractTicketKeyFromSubject(subject: string): string | null {
  // Pattern: [KEY-YYYY-NNNNNN] or [KEY-NNNNNN]
  const patterns = [
    /\[([A-Z]+-\d{4}-\d+)\]/i,  // [AGR-2024-000123]
    /\[([A-Z]+-\d+)\]/i,         // [AGR-123]
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Find ticket by key extracted from subject
 */
export async function findTicketByKey(ticketKey: string): Promise<typeof tickets.$inferSelect | null> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.key, ticketKey),
  });

  return ticket || null;
}

/**
 * Find ticket by message ID reference
 * Searches ticket comments for matching message IDs
 */
export async function findTicketByMessageId(messageId: string): Promise<typeof tickets.$inferSelect | null> {
  // Find comment with this message ID
  const comment = await db.query.ticketComments.findFirst({
    where: eq(ticketComments.messageId, messageId),
    with: {
      ticket: true,
    },
  });

  return comment?.ticket || null;
}

/**
 * Find ticket by In-Reply-To header
 * Searches for comments that have this message ID
 */
export async function findTicketByInReplyTo(inReplyTo: string): Promise<typeof tickets.$inferSelect | null> {
  // Find comment that this email is replying to
  const comment = await db.query.ticketComments.findFirst({
    where: eq(ticketComments.messageId, inReplyTo),
    with: {
      ticket: true,
    },
  });

  return comment?.ticket || null;
}

/**
 * Find ticket by References header
 * Parses the References header (space-separated message IDs) and searches for any match
 */
export async function findTicketByReferences(references: string): Promise<typeof tickets.$inferSelect | null> {
  // References header contains space-separated message IDs
  const messageIds = references
    .split(/\s+/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (messageIds.length === 0) {
    return null;
  }

  // Search for any comment with these message IDs
  for (const messageId of messageIds) {
    const comment = await db.query.ticketComments.findFirst({
      where: eq(ticketComments.messageId, messageId),
      with: {
        ticket: true,
      },
    });

    if (comment?.ticket) {
      return comment.ticket;
    }
  }

  return null;
}

/**
 * Match incoming email to an existing ticket
 * 
 * Tries multiple strategies in order:
 * 1. Extract ticket key from subject
 * 2. Match by In-Reply-To header
 * 3. Match by References header
 * 4. Match by Message-ID (if this is a forwarded email)
 * 
 * @param email - Email data with headers
 * @returns Matched ticket or null if no match found
 */
export async function matchEmailToTicket(email: {
  subject: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}): Promise<typeof tickets.$inferSelect | null> {
  // Strategy 1: Extract ticket key from subject
  if (email.subject) {
    const ticketKey = extractTicketKeyFromSubject(email.subject);
    if (ticketKey) {
      const ticket = await findTicketByKey(ticketKey);
      if (ticket) {
        return ticket;
      }
    }
  }

  // Strategy 2: Match by In-Reply-To header
  if (email.inReplyTo) {
    const ticket = await findTicketByInReplyTo(email.inReplyTo);
    if (ticket) {
      return ticket;
    }
  }

  // Strategy 3: Match by References header
  if (email.references) {
    const ticket = await findTicketByReferences(email.references);
    if (ticket) {
      return ticket;
    }
  }

  // Strategy 4: Match by Message-ID (for forwarded emails)
  if (email.messageId) {
    const ticket = await findTicketByMessageId(email.messageId);
    if (ticket) {
      return ticket;
    }
  }

  return null;
}

/**
 * Generate a unique message ID for outgoing emails
 */
export function generateMessageId(ticketId: string, commentId: string): string {
  const domain = process.env.EMAIL_DOMAIN || 'support.example.com';
  return `<${ticketId}-${commentId}@${domain}>`;
}
