/**
 * Anonymization logic for GDPR compliance
 * 
 * Handles right to be forgotten / data anonymization
 */

import { db } from '@/db';
import { tickets, ticketComments } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Anonymize a ticket and all its associated data
 */
export async function anonymizeTicketData(ticketId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Anonymize ticket
    await tx
      .update(tickets)
      .set({
        requesterEmail: 'anonymized@deleted.local',
        isAnonymized: true,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));

    // Anonymize all comments
    await tx
      .update(ticketComments)
      .set({
        authorEmail: 'anonymized@deleted.local',
        content: '[Content anonymized per user request]',
        isAnonymized: true,
      })
      .where(eq(ticketComments.ticketId, ticketId));
  });
}

/**
 * Anonymize all tickets for a specific email address (user request)
 */
export async function anonymizeUserData(email: string, orgId: string): Promise<number> {
  // Find all tickets for this email in this org
  const userTickets = await db.query.tickets.findMany({
    where: and(
      eq(tickets.orgId, orgId),
      eq(tickets.requesterEmail, email),
      eq(tickets.isAnonymized, false),
      isNull(tickets.deletedAt)
    ),
    columns: {
      id: true,
    },
  });

  let anonymized = 0;

  for (const ticket of userTickets) {
    await anonymizeTicketData(ticket.id);
    anonymized++;
  }

  return anonymized;
}

/**
 * Soft delete a ticket (for right to delete)
 */
export async function deleteTicketData(ticketId: string): Promise<void> {
  const now = new Date();
  
  await db.transaction(async (tx) => {
    // Soft delete ticket
    await tx
      .update(tickets)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(tickets.id, ticketId));

    // Soft delete all comments
    await tx
      .update(ticketComments)
      .set({
        deletedAt: now,
      })
      .where(eq(ticketComments.ticketId, ticketId));
  });
}

/**
 * Delete all tickets for a specific email address (user request)
 */
export async function deleteUserData(email: string, orgId: string): Promise<number> {
  const userTickets = await db.query.tickets.findMany({
    where: and(
      eq(tickets.orgId, orgId),
      eq(tickets.requesterEmail, email),
      isNull(tickets.deletedAt)
    ),
    columns: {
      id: true,
    },
  });

  let deleted = 0;

  for (const ticket of userTickets) {
    await deleteTicketData(ticket.id);
    deleted++;
  }

  return deleted;
}

