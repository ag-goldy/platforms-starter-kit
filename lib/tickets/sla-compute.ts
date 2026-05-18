import { db } from '@/db';
import { tickets, slaPolicies, ticketMessages, ticketEvents } from '@/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { resolveBusinessHours } from '@/lib/utils/date'; // Assuming date util

export async function resolveSLATargets(
  orgId: string,
  priority: string,
  createdAt: Date
): Promise<{ responseDueAt: Date | null; resolutionDueAt: Date | null; slaPolicyId: string | null }> {
  const policy = await db.query.slaPolicies.findFirst({
    where: and(eq(slaPolicies.orgId, orgId), eq(slaPolicies.active, true)),
  });

  if (!policy) {
    return { responseDueAt: null, resolutionDueAt: null, slaPolicyId: null };
  }

  // Simplified due time logic for phase 3: (createdAt + minutes)
  // Need to handle businessHours via util later
  const responseDueAt = new Date(createdAt.getTime() + policy.responseMinutes * 60000);
  const resolutionDueAt = new Date(createdAt.getTime() + policy.resolutionMinutes * 60000);

  return {
    responseDueAt,
    resolutionDueAt,
    slaPolicyId: policy.id,
  };
}

export async function markFirstResponse(ticketId: string, orgId: string, authorId: string) {
  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)),
  });
  if (!ticket) return;

  // Since we don't have a firstResponseAt column in new schema, we determine if it's the first response implicitly,
  // or we can add an event `sla_first_response`
  const existingEvent = await db.query.ticketEvents.findFirst({
    where: and(
      eq(ticketEvents.ticketId, ticketId),
      eq(ticketEvents.eventType, 'sla_first_response')
    )
  });

  if (!existingEvent) {
    await db.insert(ticketEvents).values({
      orgId,
      ticketId,
      actorId: authorId,
      actorKind: 'user',
      eventType: 'sla_first_response',
    });
  }
}
