'use server';

import { db } from '@/db';
import { tickets, escalationRules, ticketComments, users } from '@/db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';

/**
 * Check and process escalation rules for tickets
 * This should be called by a scheduled job (e.g., every 5 minutes)
 */
export async function processEscalationRules(orgId?: string) {
  const now = new Date();

  // Build query conditions
  const conditions = [eq(escalationRules.isActive, true)];
  if (orgId) {
    conditions.push(eq(escalationRules.orgId, orgId));
  }

  const rules = await db.query.escalationRules.findMany({
    where: and(...conditions),
  });

  const results: { ruleId: string; escalations: number; errors: string[] }[] = [];

  for (const rule of rules) {
    const ruleResult = { ruleId: rule.id, escalations: 0, errors: [] as string[] };

    try {
      const applicablePriorities = (rule.applicablePriorities as string[]) || ['P1', 'P2', 'P3', 'P4'];
      const applicableCategories = (rule.applicableCategories as string[]) || ['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST'];

      // Find tickets matching this rule's criteria
      const timeThreshold = new Date(now.getTime() - rule.timeThreshold * 60 * 1000);

      const ticketConditions = [
        eq(tickets.orgId, rule.orgId),
        eq(tickets.status, 'OPEN'),
        sql`${tickets.priority} = ANY(${applicablePriorities})`,
        sql`${tickets.category} = ANY(${applicableCategories})`,
      ];

      // Add trigger-specific conditions
      if (rule.triggerType === 'no_response') {
        // Tickets with no response in timeThreshold
        ticketConditions.push(
          sql`(
          ${tickets.firstResponseAt} IS NULL 
          AND ${tickets.createdAt} < ${timeThreshold}
        ) OR (
          ${tickets.firstResponseAt} IS NOT NULL 
          AND NOT EXISTS (
            SELECT 1 FROM ${ticketComments}
            WHERE ${ticketComments.ticketId} = ${tickets.id}
            AND ${ticketComments.createdAt} > ${timeThreshold}
          )
        )`
        );
      } else if (rule.triggerType === 'no_resolution') {
        // Tickets not resolved in timeThreshold
        ticketConditions.push(
          sql`${tickets.resolvedAt} IS NULL AND ${tickets.createdAt} < ${timeThreshold}`
        );
      } else if (rule.triggerType === 'sla_warning') {
        // Tickets approaching SLA breach (handled separately by SLA tracking)
        continue;
      } else if (rule.triggerType === 'sla_breach') {
        // Tickets that have breached SLA (handled separately by SLA tracking)
        continue;
      }

      const matchingTickets = await db.query.tickets.findMany({
        where: and(...ticketConditions),
        columns: {
          id: true,
          key: true,
          subject: true,
          priority: true,
          assigneeId: true,
        },
      });

      const actions = rule.actions as {
        notifyUserIds?: string[];
        notifyGroupIds?: string[];
        changePriority?: 'P1' | 'P2' | 'P3' | 'P4';
        addTags?: string[];
        assignToUserId?: string;
        addComment?: string;
      };

      for (const ticket of matchingTickets) {
        try {
          // Execute actions
          const updateData: Partial<typeof tickets.$inferInsert> = {
            updatedAt: now,
          };

          if (actions.changePriority) {
            updateData.priority = actions.changePriority;
          }

          if (actions.assignToUserId) {
            updateData.assigneeId = actions.assignToUserId;
          }

          // Update ticket
          await db
            .update(tickets)
            .set(updateData)
            .where(eq(tickets.id, ticket.id));

          // Add comment if specified
          if (actions.addComment) {
            await db.insert(ticketComments).values({
              ticketId: ticket.id,
              userId: actions.assignToUserId || ticket.assigneeId || 'system',
              content: actions.addComment.replace(/\{ticketKey\}/g, ticket.key),
              isInternal: true,
              createdAt: now,
            });
          }

          // TODO: Send notifications to notifyUserIds and notifyGroupIds

          ruleResult.escalations++;
        } catch (error) {
          ruleResult.errors.push(`Ticket ${ticket.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      ruleResult.errors.push(`Rule processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    results.push(ruleResult);
  }

  return results;
}

/**
 * Check for SLA breach warnings and breaches
 */
export async function checkSLAEscalations(orgId?: string) {
  // Use SQL NOW() function instead of JavaScript Date to avoid type issues
  // Find tickets approaching SLA breach (warning) - 80% of target time elapsed
  const warningTickets = await db.query.tickets.findMany({
    where: and(
      orgId ? eq(tickets.orgId, orgId) : undefined,
      eq(tickets.status, 'OPEN'),
      sql`${tickets.slaResponseTargetHours} IS NOT NULL`,
      sql`${tickets.firstResponseAt} IS NULL`,
      sql`EXTRACT(EPOCH FROM (NOW() - ${tickets.createdAt})) / 3600 > (${tickets.slaResponseTargetHours} * 0.8)`
    ),
    columns: {
      id: true,
      key: true,
      subject: true,
      orgId: true,
      slaResponseTargetHours: true,
    },
  });

  // Find tickets that have breached SLA
  const breachedTickets = await db.query.tickets.findMany({
    where: and(
      orgId ? eq(tickets.orgId, orgId) : undefined,
      eq(tickets.status, 'OPEN'),
      sql`${tickets.slaResponseTargetHours} IS NOT NULL`,
      sql`${tickets.firstResponseAt} IS NULL`,
      sql`EXTRACT(EPOCH FROM (NOW() - ${tickets.createdAt})) / 3600 > ${tickets.slaResponseTargetHours}`
    ),
    columns: {
      id: true,
      key: true,
      subject: true,
      orgId: true,
      priority: true,
    },
  });

  return {
    warnings: warningTickets,
    breaches: breachedTickets,
  };
}


