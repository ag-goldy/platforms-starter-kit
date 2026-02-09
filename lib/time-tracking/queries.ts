import { eq, and, gte, lte, desc, sql, sum, count } from 'drizzle-orm';
import { db } from '@/db';
import { timeEntries, activeTimers, timeTrackingSettings, tickets } from '@/db/schema';

export interface StartTimerInput {
  ticketId: string;
  orgId: string;
  userId: string;
  description?: string;
  isBillable?: boolean;
}

export interface StopTimerInput {
  ticketId: string;
  userId: string;
}

export interface CreateTimeEntryInput {
  ticketId: string;
  orgId: string;
  userId: string;
  startedAt: Date;
  endedAt: Date;
  description?: string;
  isBillable?: boolean;
  hourlyRate?: number;
}

/**
 * Get time tracking settings for an organization
 */
export async function getTimeTrackingSettings(orgId: string) {
  const [settings] = await db
    .select()
    .from(timeTrackingSettings)
    .where(eq(timeTrackingSettings.orgId, orgId));

  return settings;
}

/**
 * Enable/configure time tracking for an organization
 */
export async function configureTimeTracking(
  orgId: string,
  config: {
    enabled?: boolean;
    defaultHourlyRate?: number;
    requireDescription?: boolean;
    minimumEntryMinutes?: number;
    roundToMinutes?: number;
    allowManualEntry?: boolean;
    autoPauseOnStatus?: boolean;
  }
) {
  const [settings] = await db
    .insert(timeTrackingSettings)
    .values({
      orgId,
      ...config,
      defaultHourlyRate: config.defaultHourlyRate !== undefined ? String(config.defaultHourlyRate) : undefined,
    })
    .onConflictDoUpdate({
      target: timeTrackingSettings.orgId,
      set: {
        ...config,
        defaultHourlyRate: config.defaultHourlyRate !== undefined ? String(config.defaultHourlyRate) : undefined,
        updatedAt: new Date(),
      },
    })
    .returning();

  return settings;
}

/**
 * Start a timer for a ticket
 */
export async function startTimer(input: StartTimerInput) {
  // Check if timer already exists
  const [existing] = await db
    .select()
    .from(activeTimers)
    .where(eq(activeTimers.ticketId, input.ticketId));

  if (existing) {
    // Resume existing timer
    const [updated] = await db
      .update(activeTimers)
      .set({
        lastResumedAt: new Date(),
      })
      .where(eq(activeTimers.id, existing.id))
      .returning();
    return { timer: updated, resumed: true };
  }

  // Create new timer
  const [timer] = await db
    .insert(activeTimers)
    .values({
      ticketId: input.ticketId,
      userId: input.userId,
      description: input.description,
      isBillable: input.isBillable ?? true,
    })
    .returning();

  return { timer, resumed: false };
}

/**
 * Pause a timer (stops tracking but keeps active)
 */
export async function pauseTimer(ticketId: string, userId: string) {
  const [timer] = await db
    .select()
    .from(activeTimers)
    .where(and(eq(activeTimers.ticketId, ticketId), eq(activeTimers.userId, userId)));

  if (!timer) return null;

  // Calculate paused duration
  const now = new Date();
  const resumedAt = new Date(timer.lastResumedAt);
  const pausedMinutes = Math.floor((now.getTime() - resumedAt.getTime()) / 60000);

  const [updated] = await db
    .update(activeTimers)
    .set({
      totalPausedMinutes: timer.totalPausedMinutes + pausedMinutes,
    })
    .where(eq(activeTimers.id, timer.id))
    .returning();

  return updated;
}

/**
 * Stop a timer and create a time entry
 */
export async function stopTimer(input: StopTimerInput) {
  const [timer] = await db
    .select()
    .from(activeTimers)
    .where(and(eq(activeTimers.ticketId, input.ticketId), eq(activeTimers.userId, input.userId)));

  if (!timer) return null;

  // Calculate duration
  const now = new Date();
  const startedAt = new Date(timer.startedAt);
  const totalMinutes = Math.floor((now.getTime() - startedAt.getTime()) / 60000) - timer.totalPausedMinutes;

  // Get settings for rounding
  const [settings] = await db
    .select()
    .from(timeTrackingSettings)
    .where(
      sql`EXISTS (SELECT 1 FROM tickets WHERE id = ${input.ticketId} AND org_id = ${timeTrackingSettings.orgId})`
    );

  const roundTo = settings?.roundToMinutes || 1;
  const roundedMinutes = Math.ceil(totalMinutes / roundTo) * roundTo;

  // Create time entry
  const [entry] = await db
    .insert(timeEntries)
    .values({
      ticketId: input.ticketId,
      orgId: sql`(SELECT org_id FROM tickets WHERE id = ${input.ticketId})`,
      userId: input.userId,
      startedAt: timer.startedAt,
      endedAt: now,
      durationMinutes: roundedMinutes,
      description: timer.description,
      isBillable: timer.isBillable,
      hourlyRate: settings?.defaultHourlyRate ? String(settings.defaultHourlyRate) : null,
      billedAmount: timer.isBillable && settings?.defaultHourlyRate
        ? String(((roundedMinutes / 60) * Number(settings.defaultHourlyRate)).toFixed(2))
        : null,
    })
    .returning();

  // Delete active timer
  await db.delete(activeTimers).where(eq(activeTimers.id, timer.id));

  return { entry, durationMinutes: roundedMinutes };
}

/**
 * Get active timer for a user
 */
export async function getUserActiveTimer(userId: string) {
  const [timer] = await db
    .select({
      timer: activeTimers,
      ticket: {
        key: tickets.key,
        subject: tickets.subject,
      },
    })
    .from(activeTimers)
    .leftJoin(tickets, eq(activeTimers.ticketId, tickets.id))
    .where(eq(activeTimers.userId, userId));

  return timer;
}

/**
 * Get all active timers for an organization
 */
export async function getOrgActiveTimers(orgId: string) {
  const timers = await db
    .select({
      timer: activeTimers,
      ticket: {
        key: tickets.key,
        subject: tickets.subject,
      },
    })
    .from(activeTimers)
    .innerJoin(tickets, eq(activeTimers.ticketId, tickets.id))
    .where(eq(tickets.orgId, orgId));

  return timers;
}

/**
 * Get time entries for a ticket
 */
export async function getTicketTimeEntries(ticketId: string) {
  return await db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.ticketId, ticketId))
    .orderBy(desc(timeEntries.startedAt));
}

/**
 * Get time entries for a user
 */
export async function getUserTimeEntries(
  userId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    orgId?: string;
  } = {}
) {
  const { startDate, endDate, orgId } = options;

  const conditions = [eq(timeEntries.userId, userId)];

  if (startDate) {
    conditions.push(gte(timeEntries.startedAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(timeEntries.endedAt, endDate));
  }
  if (orgId) {
    conditions.push(eq(timeEntries.orgId, orgId));
  }

  return await db
    .select({
      entry: timeEntries,
      ticket: {
        key: tickets.key,
        subject: tickets.subject,
      },
    })
    .from(timeEntries)
    .leftJoin(tickets, eq(timeEntries.ticketId, tickets.id))
    .where(and(...conditions))
    .orderBy(desc(timeEntries.startedAt));
}

/**
 * Create a manual time entry
 */
export async function createManualTimeEntry(input: CreateTimeEntryInput) {
  const durationMinutes = Math.floor(
    (input.endedAt.getTime() - input.startedAt.getTime()) / 60000
  );

  const [settings] = await db
    .select()
    .from(timeTrackingSettings)
    .where(eq(timeTrackingSettings.orgId, input.orgId));

  const hourlyRate = input.hourlyRate ?? settings?.defaultHourlyRate;

  const [entry] = await db
    .insert(timeEntries)
    .values({
      ticketId: input.ticketId,
      orgId: input.orgId,
      userId: input.userId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMinutes,
      description: input.description,
      isBillable: input.isBillable ?? true,
      isManualEntry: true,
      manualDate: input.startedAt.toISOString().split('T')[0],
      hourlyRate: hourlyRate ? String(hourlyRate) : null,
      billedAmount: input.isBillable !== false && hourlyRate
        ? String(((durationMinutes / 60) * Number(hourlyRate)).toFixed(2))
        : null,
    })
    .returning();

  return entry;
}

/**
 * Get time summary for a ticket
 */
export async function getTicketTimeSummary(ticketId: string) {
  const result = await db
    .select({
      totalMinutes: sum(timeEntries.durationMinutes),
      billableMinutes: sum(sql`CASE WHEN ${timeEntries.isBillable} THEN ${timeEntries.durationMinutes} ELSE 0 END`),
      totalBillableAmount: sum(timeEntries.billedAmount),
      entryCount: count(),
    })
    .from(timeEntries)
    .where(eq(timeEntries.ticketId, ticketId));

  return {
    totalMinutes: Number(result[0]?.totalMinutes || 0),
    billableMinutes: Number(result[0]?.billableMinutes || 0),
    totalBillableAmount: Number(result[0]?.totalBillableAmount || 0),
    entryCount: Number(result[0]?.entryCount || 0),
  };
}

/**
 * Get time report for organization
 */
export async function getOrgTimeReport(
  orgId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    billableOnly?: boolean;
  } = {}
) {
  const { startDate, endDate, userId, billableOnly } = options;

  const conditions = [eq(timeEntries.orgId, orgId)];

  if (startDate) {
    conditions.push(gte(timeEntries.startedAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(timeEntries.endedAt, endDate));
  }
  if (userId) {
    conditions.push(eq(timeEntries.userId, userId));
  }
  if (billableOnly) {
    conditions.push(eq(timeEntries.isBillable, true));
  }

  const entries = await db
    .select({
      entry: timeEntries,
      ticket: {
        key: tickets.key,
        subject: tickets.subject,
      },
    })
    .from(timeEntries)
    .leftJoin(tickets, eq(timeEntries.ticketId, tickets.id))
    .where(and(...conditions))
    .orderBy(desc(timeEntries.startedAt));

  // Calculate totals
  const totals = await db
    .select({
      totalMinutes: sum(timeEntries.durationMinutes),
      billableMinutes: sum(sql`CASE WHEN ${timeEntries.isBillable} THEN ${timeEntries.durationMinutes} ELSE 0 END`),
      totalBillableAmount: sum(timeEntries.billedAmount),
    })
    .from(timeEntries)
    .where(and(...conditions));

  return {
    entries,
    summary: {
      totalMinutes: Number(totals[0]?.totalMinutes || 0),
      billableMinutes: Number(totals[0]?.billableMinutes || 0),
      totalBillableAmount: Number(totals[0]?.totalBillableAmount || 0),
    },
  };
}

/**
 * Mark time entries as invoiced
 */
export async function markEntriesAsInvoiced(
  entryIds: string[],
  invoiceId: string
) {
  await db
    .update(timeEntries)
    .set({
      invoiceId,
      invoicedAt: new Date(),
    })
    .where(sql`${timeEntries.id} = ANY(${entryIds})`);
}

/**
 * Get uninvoiced billable time
 */
export async function getUninvoicedTime(orgId: string) {
  return await db
    .select({
      entry: timeEntries,
      ticket: {
        key: tickets.key,
        subject: tickets.subject,
      },
    })
    .from(timeEntries)
    .leftJoin(tickets, eq(timeEntries.ticketId, tickets.id))
    .where(
      and(
        eq(timeEntries.orgId, orgId),
        eq(timeEntries.isBillable, true),
        sql`${timeEntries.invoicedAt} IS NULL`
      )
    )
    .orderBy(desc(timeEntries.startedAt));
}

/**
 * Auto-pause all timers for a ticket when it's resolved
 */
export async function autoPauseTicketTimers(ticketId: string) {
  // Get settings to check if auto-pause is enabled
  const [ticket] = await db
    .select({ orgId: tickets.orgId })
    .from(tickets)
    .where(eq(tickets.id, ticketId));

  if (!ticket) return;

  const [settings] = await db
    .select()
    .from(timeTrackingSettings)
    .where(eq(timeTrackingSettings.orgId, ticket.orgId));

  if (!settings?.autoPauseOnStatus) return;

  // Stop all active timers for this ticket
  const timers = await db
    .select()
    .from(activeTimers)
    .where(eq(activeTimers.ticketId, ticketId));

  for (const timer of timers) {
    await stopTimer({ ticketId, userId: timer.userId });
  }
}
