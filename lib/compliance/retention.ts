/**
 * Data retention policy engine
 * 
 * Handles data retention, anonymization, and cleanup based on organizational policies
 */

import { db } from '@/db';
import { tickets, ticketComments, organizations } from '@/db/schema';
import { eq, and, lte, isNull, sql } from 'drizzle-orm';

export type RetentionPolicy = 'KEEP_FOREVER' | 'DELETE_AFTER_DAYS' | 'ANONYMIZE_AFTER_DAYS';

export interface RetentionConfig {
  policy: RetentionPolicy;
  days: number | null;
}

/**
 * Get retention config for an organization
 */
export async function getRetentionConfig(orgId: string): Promise<RetentionConfig> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: {
      retentionPolicy: true,
      dataRetentionDays: true,
    },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  return {
    policy: (org.retentionPolicy as RetentionPolicy) || 'KEEP_FOREVER',
    days: org.dataRetentionDays || null,
  };
}

/**
 * Apply retention policy to an organization's data
 * Idempotent: Only processes tickets that haven't been processed today
 */
export async function applyRetentionPolicy(orgId: string): Promise<{
  anonymized: number;
  deleted: number;
}> {
  const config = await getRetentionConfig(orgId);

  if (config.policy === 'KEEP_FOREVER') {
    return { anonymized: 0, deleted: 0 };
  }

  if (!config.days) {
    throw new Error('Retention days must be set for this policy');
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.days);
  
  // Idempotency: Only process tickets that haven't been processed today
  // Check updatedAt to see if ticket was already processed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let anonymized = 0;
  let deleted = 0;

  if (config.policy === 'ANONYMIZE_AFTER_DAYS') {
    // Anonymize old tickets and comments
    // Idempotency: Skip tickets that were already anonymized today
    const oldTickets = await db.query.tickets.findMany({
      where: and(
        eq(tickets.orgId, orgId),
        lte(tickets.createdAt, cutoffDate),
        eq(tickets.isAnonymized, false),
        isNull(tickets.deletedAt),
        // Only process if not updated today (idempotency check)
        sql`${tickets.updatedAt} < ${today}`
      ),
    });

    for (const ticket of oldTickets) {
      await anonymizeTicket(ticket.id);
      anonymized++;
    }
  } else if (config.policy === 'DELETE_AFTER_DAYS') {
    // Soft delete old tickets and comments
    // Idempotency: Skip tickets that were already deleted today
    const oldTickets = await db.query.tickets.findMany({
      where: and(
        eq(tickets.orgId, orgId),
        lte(tickets.createdAt, cutoffDate),
        isNull(tickets.deletedAt),
        // Only process if not updated today (idempotency check)
        sql`${tickets.updatedAt} < ${today}`
      ),
    });

    for (const ticket of oldTickets) {
      await softDeleteTicket(ticket.id);
      deleted++;
    }
  }

  return { anonymized, deleted };
}

/**
 * Anonymize a ticket and its comments
 */
async function anonymizeTicket(ticketId: string): Promise<void> {
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

    // Anonymize comments
    await tx
      .update(ticketComments)
      .set({
        authorEmail: 'anonymized@deleted.local',
        content: '[Content anonymized]',
        isAnonymized: true,
      })
      .where(eq(ticketComments.ticketId, ticketId));
  });
}

/**
 * Soft delete a ticket and its comments
 */
async function softDeleteTicket(ticketId: string): Promise<void> {
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

    // Soft delete comments
    await tx
      .update(ticketComments)
      .set({
        deletedAt: now,
      })
      .where(eq(ticketComments.ticketId, ticketId));
  });
}

/**
 * Batch apply retention policies to all organizations
 */
export async function applyRetentionPoliciesToAllOrgs(): Promise<{
  [orgId: string]: { anonymized: number; deleted: number };
}> {
  const allOrgs = await db.query.organizations.findMany({
    columns: {
      id: true,
    },
  });

  const results: { [orgId: string]: { anonymized: number; deleted: number } } = {};

  for (const org of allOrgs) {
    try {
      const result = await applyRetentionPolicy(org.id);
      results[org.id] = result;
    } catch (error) {
      console.error(`Failed to apply retention policy for org ${org.id}:`, error);
      results[org.id] = { anonymized: 0, deleted: 0 };
    }
  }

  return results;
}

