"use server";

import { db } from "@/db";
import {
  escalationRules,
  notifications,
  ticketComments,
  tickets,
  ticketTagAssignments,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { calculateSLAClock } from "@/lib/tickets/sla";

const openSLAStatuses = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
] as const;
type EscalationTrigger = "sla_warning" | "sla_breach";

function escalationMarker(
  trigger: EscalationTrigger,
  metric: "response" | "resolution",
) {
  return `[atlas:${trigger}:${metric}]`;
}

async function hasEscalationMarker(
  ticketId: string,
  marker: string,
): Promise<boolean> {
  const existing = await db.query.ticketComments.findFirst({
    where: and(
      eq(ticketComments.ticketId, ticketId),
      sql`${ticketComments.content} like ${`%${marker}%`}`,
    ),
    columns: { id: true },
  });
  return Boolean(existing);
}

async function addSystemEscalationComment(
  ticketId: string,
  marker: string,
  content: string,
): Promise<boolean> {
  if (await hasEscalationMarker(ticketId, marker)) {
    return false;
  }

  await db.insert(ticketComments).values({
    ticketId,
    content: `${marker} ${content}`,
    isInternal: true,
  });
  return true;
}

async function applyEscalationActions(params: {
  ticket: {
    id: string;
    key: string;
    orgId: string | null;
    assigneeId: string | null;
    priority: "P1" | "P2" | "P3" | "P4";
  };
  actions: {
    notifyUserIds?: string[];
    changePriority?: "P1" | "P2" | "P3" | "P4";
    addTags?: string[];
    assignToUserId?: string;
    addComment?: string;
  };
  now: Date;
}) {
  const { ticket, actions, now } = params;
  const updateData: Partial<typeof tickets.$inferInsert> = { updatedAt: now };

  if (actions.changePriority && actions.changePriority !== ticket.priority) {
    updateData.priority = actions.changePriority;
  }
  if (actions.assignToUserId) {
    updateData.assigneeId = actions.assignToUserId;
  }

  await db.update(tickets).set(updateData).where(eq(tickets.id, ticket.id));

  if (actions.addComment) {
    await db.insert(ticketComments).values({
      ticketId: ticket.id,
      userId: actions.assignToUserId || ticket.assigneeId || null,
      content: actions.addComment.replace(/\{ticketKey\}/g, ticket.key),
      isInternal: true,
      createdAt: now,
    });
  }

  if (actions.addTags?.length) {
    await db
      .insert(ticketTagAssignments)
      .values(
        actions.addTags.map((tagId) => ({
          ticketId: ticket.id,
          tagId,
          assignedById: actions.assignToUserId || null,
        })),
      )
      .onConflictDoNothing();
  }

  const orgId = ticket.orgId;
  if (orgId && actions.notifyUserIds?.length) {
    await db
      .insert(notifications)
      .values(
        actions.notifyUserIds.map((userId) => ({
          userId,
          type: "TICKET_SLA_WARNING" as const,
          title: `SLA escalation for ${ticket.key}`,
          message: `Ticket ${ticket.key} matched an escalation rule.`,
          data: { ticketId: ticket.id, orgId },
          link: `/app/tickets/${ticket.id}`,
        })),
      )
      .onConflictDoNothing();
  }
}

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

  const results: { ruleId: string; escalations: number; errors: string[] }[] =
    [];

  for (const rule of rules) {
    const ruleResult = {
      ruleId: rule.id,
      escalations: 0,
      errors: [] as string[],
    };

    try {
      const applicablePriorities = (rule.applicablePriorities as string[]) || [
        "P1",
        "P2",
        "P3",
        "P4",
      ];
      const applicableCategories = (rule.applicableCategories as string[]) || [
        "INCIDENT",
        "SERVICE_REQUEST",
        "CHANGE_REQUEST",
      ];

      // Find tickets matching this rule's criteria
      const timeThreshold = new Date(
        now.getTime() - rule.timeThreshold * 60 * 1000,
      );

      const ticketConditions = [
        eq(tickets.orgId, rule.orgId),
        eq(tickets.status, "OPEN"),
        sql`${tickets.priority} = ANY(${applicablePriorities})`,
        sql`${tickets.category} = ANY(${applicableCategories})`,
      ];

      // Add trigger-specific conditions
      if (rule.triggerType === "no_response") {
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
        )`,
        );
      } else if (rule.triggerType === "no_resolution") {
        // Tickets not resolved in timeThreshold
        ticketConditions.push(
          sql`${tickets.resolvedAt} IS NULL AND ${tickets.createdAt} < ${timeThreshold}`,
        );
      } else if (rule.triggerType === "sla_warning") {
        // Tickets approaching SLA breach (handled separately by SLA tracking)
        continue;
      } else if (rule.triggerType === "sla_breach") {
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
        changePriority?: "P1" | "P2" | "P3" | "P4";
        addTags?: string[];
        assignToUserId?: string;
        addComment?: string;
      };

      for (const ticket of matchingTickets) {
        try {
          await applyEscalationActions({
            ticket: { ...ticket, orgId: rule.orgId },
            actions,
            now,
          });

          ruleResult.escalations++;
        } catch (error) {
          ruleResult.errors.push(
            `Ticket ${ticket.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }
    } catch (error) {
      ruleResult.errors.push(
        `Rule processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    results.push(ruleResult);
  }

  return results;
}

/**
 * Check for SLA breach warnings and breaches
 */
export async function checkSLAEscalations(orgId?: string) {
  const now = new Date();
  const candidateTickets = await db.query.tickets.findMany({
    where: and(
      orgId ? eq(tickets.orgId, orgId) : undefined,
      inArray(tickets.status, [...openSLAStatuses]),
      sql`(${tickets.slaResponseTargetHours} IS NOT NULL OR ${tickets.slaResolutionTargetHours} IS NOT NULL)`,
    ),
    columns: {
      id: true,
      key: true,
      subject: true,
      orgId: true,
      status: true,
      priority: true,
      createdAt: true,
      firstResponseAt: true,
      resolvedAt: true,
      slaPausedAt: true,
      slaResponseTargetHours: true,
      slaResolutionTargetHours: true,
    },
  });

  const warnings: typeof candidateTickets = [];
  const breaches: typeof candidateTickets = [];

  for (const ticket of candidateTickets) {
    const clock = calculateSLAClock({
      createdAt: ticket.createdAt,
      firstResponseAt: ticket.firstResponseAt,
      resolvedAt: ticket.resolvedAt,
      now,
      status: ticket.status,
      responseTargetHours: ticket.slaResponseTargetHours,
      resolutionTargetHours: ticket.slaResolutionTargetHours,
      pausedAt: ticket.slaPausedAt,
    });

    if (
      clock.responseStatus === "warning" ||
      clock.resolutionStatus === "warning"
    ) {
      const metric =
        clock.responseStatus === "warning" ? "response" : "resolution";
      const added = await addSystemEscalationComment(
        ticket.id,
        escalationMarker("sla_warning", metric),
        `SLA ${metric} warning for ticket ${ticket.key}.`,
      );
      if (added) warnings.push(ticket);
    }

    if (
      clock.responseStatus === "breached" ||
      clock.resolutionStatus === "breached"
    ) {
      const metric =
        clock.responseStatus === "breached" ? "response" : "resolution";
      const added = await addSystemEscalationComment(
        ticket.id,
        escalationMarker("sla_breach", metric),
        `SLA ${metric} breached for ticket ${ticket.key}.`,
      );
      if (added) breaches.push(ticket);
    }
  }

  return {
    warnings,
    breaches,
  };
}
