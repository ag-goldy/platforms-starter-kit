/**
 * SLA pause management
 * 
 * Handles pausing and resuming SLA tracking based on ticket status
 */

import { db } from '@/db';
import { tickets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { BusinessHoursConfig } from '@/lib/sla/business-hours';
import { isBusinessHours, calculateBusinessHours } from '@/lib/sla/business-hours';

export type PauseReason = 'WAITING_ON_CUSTOMER' | 'PENDING_VENDOR' | 'OUT_OF_BUSINESS_HOURS';

/**
 * Check if a ticket status should pause SLA
 */
export function shouldPauseSLA(status: string): boolean {
  return status === 'WAITING_ON_CUSTOMER';
}

/**
 * Get pause reason for a status
 */
export function getPauseReason(status: string): PauseReason | null {
  if (status === 'WAITING_ON_CUSTOMER') {
    return 'WAITING_ON_CUSTOMER';
  }
  // Future: Add PENDING_VENDOR if that status is added
  return null;
}

/**
 * Pause SLA for a ticket
 */
export async function pauseSLA(
  ticketId: string,
  reason: PauseReason
): Promise<void> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      slaPausedAt: true,
    },
  });

  // Only pause if not already paused
  if (ticket && !ticket.slaPausedAt) {
    await db
      .update(tickets)
      .set({
        slaPausedAt: new Date(),
        slaPauseReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));
  }
}

/**
 * Resume SLA for a ticket
 */
export async function resumeSLA(ticketId: string): Promise<void> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      slaPausedAt: true,
    },
  });

  // Only resume if currently paused
  if (ticket && ticket.slaPausedAt) {
    await db
      .update(tickets)
      .set({
        slaPausedAt: null,
        slaPauseReason: null,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));
  }
}

/**
 * Check and update SLA pause status based on ticket status and business hours
 */
export async function updateSLAPauseStatus(
  ticketId: string,
  status: string,
  businessHoursConfig: BusinessHoursConfig | null
): Promise<void> {
  const shouldPause = shouldPauseSLA(status);
  const pauseReason = getPauseReason(status);

  // Also check if we're outside business hours (if configured)
  let pauseForBusinessHours = false;
  if (businessHoursConfig) {
    const now = new Date();
    if (!isBusinessHours(now, businessHoursConfig)) {
      pauseForBusinessHours = true;
    }
  }

  if (shouldPause && pauseReason) {
    await pauseSLA(ticketId, pauseReason);
  } else if (pauseForBusinessHours) {
    // Pause for business hours (this would be handled differently in a real system)
    // For now, we only pause on WAITING_ON_CUSTOMER
  } else {
    // Resume if status changed away from pause condition
    await resumeSLA(ticketId);
  }
}

/**
 * Calculate effective SLA time accounting for paused periods
 */
export function calculateEffectiveSLATime(
  startDate: Date,
  endDate: Date,
  pausedAt: Date | null,
  businessHoursConfig: BusinessHoursConfig | null
): number {
  if (!pausedAt) {
    // Not paused, calculate normally (accounting for business hours if configured)
    if (businessHoursConfig) {
      // Use business hours calculation
      return calculateBusinessHours(startDate, endDate, businessHoursConfig);
    }
    // 24/7 calculation
    return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  }

  // Paused - only count time before pause
  const pauseTime = pausedAt < endDate ? pausedAt : endDate;
  const effectiveEnd = pauseTime;

  if (businessHoursConfig) {
    return calculateBusinessHours(startDate, effectiveEnd, businessHoursConfig);
  }

  return (effectiveEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60);
}

