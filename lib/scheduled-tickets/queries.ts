import { eq, and, lte, gte, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { scheduledTickets, tickets, ticketPriorityEnum, ticketCategoryEnum, scheduledTicketStatusEnum } from '@/db/schema';

export type ScheduledTicketStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface CreateScheduledTicketInput {
  orgId: string;
  createdBy: string;
  scheduledFor: Date;
  timezone?: string;
  subject: string;
  description: string;
  priority?: string;
  category?: string;
  requesterId?: string;
  requesterEmail?: string;
  assigneeId?: string;
  serviceId?: string;
  siteId?: string;
  areaId?: string;
  ccEmails?: string[];
  tags?: string[];
  customFields?: Record<string, unknown>;
  recurrencePattern?: string;
  recurrenceEndDate?: Date;
}

export interface UpdateScheduledTicketInput {
  scheduledFor?: Date;
  timezone?: string;
  subject?: string;
  description?: string;
  priority?: typeof ticketPriorityEnum.enumValues[number];
  category?: typeof ticketCategoryEnum.enumValues[number];
  requesterId?: string;
  requesterEmail?: string;
  assigneeId?: string;
  serviceId?: string;
  siteId?: string;
  areaId?: string;
  ccEmails?: string[];
  tags?: string[];
  customFields?: Record<string, unknown>;
  recurrencePattern?: string;
  recurrenceEndDate?: Date;
  status?: typeof scheduledTicketStatusEnum.enumValues[number];
}

/**
 * Create a scheduled ticket
 */
export async function createScheduledTicket(input: CreateScheduledTicketInput) {
  const [scheduled] = await db
    .insert(scheduledTickets)
    .values({
      orgId: input.orgId,
      createdBy: input.createdBy,
      scheduledFor: input.scheduledFor,
      timezone: input.timezone || 'UTC',
      subject: input.subject,
      description: input.description,
      priority: input.priority as typeof ticketPriorityEnum.enumValues[number] || 'P3',
      category: input.category as typeof ticketCategoryEnum.enumValues[number] || 'SERVICE_REQUEST',
      requesterId: input.requesterId,
      requesterEmail: input.requesterEmail,
      assigneeId: input.assigneeId,
      serviceId: input.serviceId,
      siteId: input.siteId,
      areaId: input.areaId,
      ccEmails: input.ccEmails || [],
      tags: input.tags || [],
      customFields: input.customFields || {},
      recurrencePattern: input.recurrencePattern,
      recurrenceEndDate: input.recurrenceEndDate,
    })
    .returning();

  return scheduled;
}

/**
 * Get scheduled ticket by ID
 */
export async function getScheduledTicketById(id: string) {
  const [scheduled] = await db
    .select()
    .from(scheduledTickets)
    .where(eq(scheduledTickets.id, id));

  return scheduled;
}

/**
 * Get scheduled tickets for an organization
 */
export async function getOrgScheduledTickets(
  orgId: string,
  options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { status, limit = 50, offset = 0 } = options;

  const conditions = [eq(scheduledTickets.orgId, orgId)];

  if (status) {
    conditions.push(eq(scheduledTickets.status, status as ScheduledTicketStatus));
  }

  return await db
    .select()
    .from(scheduledTickets)
    .where(and(...conditions))
    .orderBy(desc(scheduledTickets.scheduledFor))
    .limit(limit)
    .offset(offset);
}

/**
 * Get pending scheduled tickets that are due
 */
export async function getDueScheduledTickets() {
  return await db
    .select()
    .from(scheduledTickets)
    .where(
      and(
        eq(scheduledTickets.status, 'pending'),
        lte(scheduledTickets.scheduledFor, new Date())
      )
    )
    .orderBy(scheduledTickets.scheduledFor);
}

/**
 * Update a scheduled ticket
 */
export async function updateScheduledTicket(
  id: string,
  input: UpdateScheduledTicketInput
) {
  const [scheduled] = await db
    .update(scheduledTickets)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(scheduledTickets.id, id))
    .returning();

  return scheduled;
}

/**
 * Cancel a scheduled ticket
 */
export async function cancelScheduledTicket(id: string, orgId: string) {
  const [scheduled] = await db
    .update(scheduledTickets)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledTickets.id, id),
        eq(scheduledTickets.orgId, orgId)
      )
    )
    .returning();

  return scheduled;
}

/**
 * Mark scheduled ticket as processing
 */
export async function markScheduledTicketProcessing(id: string) {
  const [scheduled] = await db
    .update(scheduledTickets)
    .set({
      status: 'processing',
      processedAt: new Date(),
    })
    .where(eq(scheduledTickets.id, id))
    .returning();

  return scheduled;
}

/**
 * Mark scheduled ticket as completed (creates actual ticket)
 */
export async function markScheduledTicketCompleted(
  id: string,
  createdTicketId: string
) {
  const [scheduled] = await db
    .update(scheduledTickets)
    .set({
      status: 'completed',
      createdTicketId,
    })
    .where(eq(scheduledTickets.id, id))
    .returning();

  return scheduled;
}

/**
 * Mark scheduled ticket as failed
 */
export async function markScheduledTicketFailed(id: string, errorMessage: string) {
  const [scheduled] = await db
    .update(scheduledTickets)
    .set({
      status: 'failed',
      errorMessage,
    })
    .where(eq(scheduledTickets.id, id))
    .returning();

  return scheduled;
}

/**
 * Process a scheduled ticket - create the actual ticket
 */
export async function processScheduledTicket(scheduledId: string) {
  const scheduled = await getScheduledTicketById(scheduledId);
  if (!scheduled || scheduled.status !== 'pending') return null;

  // Mark as processing
  await markScheduledTicketProcessing(scheduledId);

  try {
    // Generate ticket key
    const keyResult = await db.execute(sql`
      SELECT nextval('ticket_key_seq_${sql.raw(scheduled.orgId.replace(/-/g, '_'))}') as seq
    `);
    const sequence = (keyResult[0] as { seq?: number })?.seq || 1;
    const key = `TKT-${String(sequence).padStart(5, '0')}`;

    // Create the actual ticket
    const [ticket] = await db
      .insert(tickets)
      .values({
        orgId: scheduled.orgId,
        key,
        subject: scheduled.subject,
        description: scheduled.description,
        priority: scheduled.priority,
        category: scheduled.category,
        requesterId: scheduled.requesterId,
        requesterEmail: scheduled.requesterEmail,
        assigneeId: scheduled.assigneeId,
        serviceId: scheduled.serviceId,
        siteId: scheduled.siteId,
        areaId: scheduled.areaId,
        ccEmails: scheduled.ccEmails,
        status: 'NEW',
      })
      .returning();

    // Mark scheduled as completed
    await markScheduledTicketCompleted(scheduledId, ticket.id);

    // Handle recurrence - create next instance
    if (scheduled.recurrencePattern && scheduled.recurrenceEndDate) {
      const nextDate = calculateNextOccurrence(
        scheduled.scheduledFor,
        scheduled.recurrencePattern
      );

      if (nextDate && nextDate <= scheduled.recurrenceEndDate) {
        await createScheduledTicket({
          orgId: scheduled.orgId,
          createdBy: scheduled.createdBy,
          scheduledFor: nextDate,
          timezone: scheduled.timezone,
          subject: scheduled.subject,
          description: scheduled.description,
          priority: scheduled.priority,
          category: scheduled.category,
          requesterId: scheduled.requesterId ?? undefined,
          requesterEmail: scheduled.requesterEmail ?? undefined,
          assigneeId: scheduled.assigneeId ?? undefined,
          serviceId: scheduled.serviceId ?? undefined,
          siteId: scheduled.siteId ?? undefined,
          areaId: scheduled.areaId ?? undefined,
          ccEmails: scheduled.ccEmails ?? undefined,
          tags: scheduled.tags ?? undefined,
          customFields: (scheduled.customFields as Record<string, unknown>) ?? undefined,
          recurrencePattern: scheduled.recurrencePattern,
          recurrenceEndDate: scheduled.recurrenceEndDate,
        });
      }
    }

    return ticket;
  } catch (error) {
    await markScheduledTicketFailed(
      scheduledId,
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Calculate next occurrence based on recurrence pattern
 */
function calculateNextOccurrence(from: Date, pattern: string): Date | null {
  const date = new Date(from);

  switch (pattern.toLowerCase()) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      return date;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      return date;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      return date;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      return date;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      return date;
    default:
      // Try to parse as cron-like or return null
      return null;
  }
}

/**
 * Get upcoming scheduled tickets count
 */
export async function getUpcomingScheduledTicketsCount(orgId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(scheduledTickets)
    .where(
      and(
        eq(scheduledTickets.orgId, orgId),
        eq(scheduledTickets.status, 'pending'),
        gte(scheduledTickets.scheduledFor, new Date())
      )
    );

  return Number(result[0]?.count || 0);
}

/**
 * Delete a scheduled ticket
 */
export async function deleteScheduledTicket(id: string, orgId: string) {
  const result = await db
    .delete(scheduledTickets)
    .where(
      and(
        eq(scheduledTickets.id, id),
        eq(scheduledTickets.orgId, orgId)
      )
    )
    .returning();

  return result.length > 0;
}
