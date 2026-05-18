import { db } from "@/db";
import {
  auditLogs,
  ticketComments,
  tickets,
  ticketStatusEnum,
} from "@/db/schema";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type LifecycleActorType = "customer" | "agent" | "automation" | "system";
export type LifecycleSource =
  | "portal"
  | "staff"
  | "api"
  | "cron"
  | "automation"
  | "migration";

export interface LifecycleActor {
  type: LifecycleActorType;
  userId?: string | null;
  platformAdminId?: string | null;
}

export interface TicketLifecycleShape {
  id: string;
  orgId: string | null;
  requesterId: string | null;
  status: TicketStatus;
  mergedIntoId: string | null;
  resolvedAt?: Date | null;
}

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

const customerClosableStatuses: TicketStatus[] = ["RESOLVED"];
const reopenableStatuses: TicketStatus[] = ["RESOLVED", "CLOSED"];

export function assertTicketMutable(
  ticket: Pick<TicketLifecycleShape, "status" | "mergedIntoId">,
): void {
  if (ticket.mergedIntoId || ticket.status === "MERGED") {
    throw new Error("Merged source tickets are read-only");
  }
}

export function canTransitionTicketStatus(params: {
  ticket: TicketLifecycleShape;
  actor: LifecycleActor;
  targetStatus: TicketStatus;
}): TransitionCheck {
  const { ticket, actor, targetStatus } = params;

  if (ticket.mergedIntoId || ticket.status === "MERGED") {
    return { allowed: false, reason: "Merged source tickets are read-only" };
  }

  if (
    actor.type === "agent" ||
    actor.type === "automation" ||
    actor.type === "system"
  ) {
    return { allowed: true };
  }

  if (actor.type === "customer") {
    if (targetStatus === "CLOSED") {
      if (!customerClosableStatuses.includes(ticket.status)) {
        return {
          allowed: false,
          reason: "Customers can only close resolved tickets",
        };
      }
      if (ticket.requesterId !== actor.userId) {
        return {
          allowed: false,
          reason: "Customers can only close their own tickets",
        };
      }
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "Customers cannot make this status transition",
    };
  }

  return { allowed: false, reason: "Unsupported actor type" };
}

export async function transitionTicketStatus({
  ticketId,
  orgId,
  actor,
  targetStatus,
  reason,
  source,
}: {
  ticketId: string;
  orgId: string;
  actor: LifecycleActor;
  targetStatus: TicketStatus;
  reason: string;
  source: LifecycleSource;
}) {
  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)),
  });

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  const check = canTransitionTicketStatus({ ticket, actor, targetStatus });
  if (!check.allowed) {
    throw new Error(check.reason || "Status transition not allowed");
  }

  const now = new Date();
  const oldStatus = ticket.status;
  const [updated] = await db
    .update(tickets)
    .set({
      status: targetStatus,
      resolvedAt:
        targetStatus === "RESOLVED"
          ? now
          : targetStatus === "CLOSED"
            ? ticket.resolvedAt || now
            : ticket.resolvedAt,
      slaPausedAt: null,
      updatedAt: now,
    })
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
    .returning();

  await db.insert(ticketComments).values({
    ticketId,
    userId: actor.userId || null,
    platformAdminId: actor.platformAdminId || null,
    content: `Status changed from ${oldStatus} to ${targetStatus}.${reason ? ` ${reason}` : ""}`,
    isInternal: false,
  });

  await db.insert(auditLogs).values({
    userId: actor.userId || null,
    platformAdminId: actor.platformAdminId || null,
    orgId,
    ticketId,
    action: "TICKET_STATUS_CHANGED",
    details: JSON.stringify({
      oldStatus,
      newStatus: targetStatus,
      reason,
      source,
      actorType: actor.type,
    }),
  });

  return updated;
}

export async function reopenTicket({
  ticketId,
  orgId,
  actor,
  reason,
}: {
  ticketId: string;
  orgId: string;
  actor: LifecycleActor;
  reason: string;
}) {
  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)),
  });

  if (!ticket) throw new Error("Ticket not found");
  assertTicketMutable(ticket);

  if (!reopenableStatuses.includes(ticket.status)) {
    return ticket;
  }
  if (actor.type === "customer" && ticket.requesterId !== actor.userId) {
    throw new Error("Customers can only reopen their own tickets");
  }

  const now = new Date();
  const [updated] = await db
    .update(tickets)
    .set({
      status: "OPEN",
      resolvedAt: null,
      firstResponseAt: null,
      slaPausedAt: null,
      updatedAt: now,
    })
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
    .returning();

  await db.insert(ticketComments).values({
    ticketId,
    userId: actor.userId || null,
    platformAdminId: actor.platformAdminId || null,
    content: `Ticket reopened. ${reason}`,
    isInternal: false,
  });

  await db.insert(auditLogs).values({
    userId: actor.userId || null,
    platformAdminId: actor.platformAdminId || null,
    orgId,
    ticketId,
    action: "TICKET_STATUS_CHANGED",
    details: JSON.stringify({
      event: "ticket.reopened",
      oldStatus: ticket.status,
      newStatus: "OPEN",
      reason,
      actorType: actor.type,
      slaCycle: "new",
    }),
  });

  return updated;
}

export async function closeResolvedTicket({
  ticketId,
  orgId,
  actor,
  reason,
}: {
  ticketId: string;
  orgId: string;
  actor: LifecycleActor;
  reason: string;
}) {
  return transitionTicketStatus({
    ticketId,
    orgId,
    actor,
    targetStatus: "CLOSED",
    reason,
    source: actor.type === "system" ? "cron" : "portal",
  });
}

export async function autoCloseResolvedTickets(now = new Date()) {
  const orgRows = await db.query.organizations.findMany({
    columns: { id: true, autoCloseResolvedDays: true },
  });

  const results: Array<{ orgId: string; closed: number; errors: string[] }> =
    [];

  for (const org of orgRows) {
    const days = org.autoCloseResolvedDays || 7;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const eligible = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, org.id),
          eq(tickets.status, "RESOLVED"),
          lt(
            sql<Date>`coalesce(${tickets.resolvedAt}, ${tickets.updatedAt})`,
            cutoff,
          ),
          isNull(tickets.deletedAt),
        ),
      )
      .limit(200);

    const errors: string[] = [];
    let closed = 0;
    for (const row of eligible) {
      try {
        await closeResolvedTicket({
          ticketId: row.id,
          orgId: org.id,
          actor: { type: "system" },
          reason: `Auto-closed after ${days} days in RESOLVED.`,
        });
        closed++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    results.push({ orgId: org.id, closed, errors });
  }

  return results;
}
