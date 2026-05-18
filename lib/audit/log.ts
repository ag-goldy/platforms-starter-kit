import { db } from "@/db";
import { auditLogs } from "@/db/schema";

type AuditAction = typeof auditLogs.$inferInsert.action;

export interface AuditLogData {
  orgId?: string;
  userId?: string;
  ticketId?: string;
  actorId?: string;
  actorKind?: "user" | "platform_admin" | "system";
  action: string;
  resource?: string;
  resourceId?: string;
  details?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

const ACTION_ALIASES: Record<string, AuditAction> = {
  COMMENT_ADDED: "TICKET_COMMENT_ADDED",
  ATTACHMENT_ADDED: "TICKET_UPDATED",
  message_added: "TICKET_COMMENT_ADDED",
  status_changed: "TICKET_STATUS_CHANGED",
  priority_changed: "TICKET_PRIORITY_CHANGED",
  assignee_changed: "TICKET_ASSIGNED",
  ticket_created: "TICKET_CREATED",
  "ticket.created": "TICKET_CREATED",
  "ticket.status_changed": "TICKET_STATUS_CHANGED",
  "ticket.priority_changed": "TICKET_PRIORITY_CHANGED",
  "ticket.assignee_changed": "TICKET_ASSIGNED",
  "ticket.comment_added": "TICKET_COMMENT_ADDED",
  "ticket.attachment_added": "TICKET_UPDATED",
  "ticket.reopened": "TICKET_STATUS_CHANGED",
  "ticket.merged": "TICKET_MERGED",
};

function normalizeAuditAction(action: string): AuditAction {
  return (ACTION_ALIASES[action] ?? action) as AuditAction;
}

function normalizeDetails(details: unknown): string | null {
  if (details == null) return null;
  if (typeof details === "string") return details;
  return JSON.stringify(details);
}

function resolveActor(data: AuditLogData): {
  userId?: string;
  platformAdminId?: string;
} {
  const actorId = data.actorId || data.userId;
  if (!actorId || data.actorKind === "system") return {};
  if (data.actorKind === "platform_admin") {
    return { platformAdminId: actorId };
  }
  return { userId: actorId };
}

export async function logAudit(data: AuditLogData) {
  const actor = resolveActor(data);
  const ticketId =
    data.ticketId || (data.resource === "ticket" ? data.resourceId : undefined);

  await db.insert(auditLogs).values({
    ...actor,
    orgId: data.orgId,
    ticketId,
    action: normalizeAuditAction(data.action),
    details: normalizeDetails(data.details),
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });
}
