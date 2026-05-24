/**
 * Migration transformation maps and helpers.
 * Centralizes all legacy → new schema value mappings.
 */

// Membership role mapping: legacy → new
export const ROLE_MAP: Record<string, string> = {
  ADMIN: "admin",
  AGENT: "agent",
  READONLY: "analyst",
  CUSTOMER_ADMIN: "end_user",
  REQUESTER: "end_user",
  VIEWER: "end_user",
};

// Ticket status mapping: legacy enum → new text
export const TICKET_STATUS_MAP: Record<string, string> = {
  NEW: "new",
  OPEN: "open",
  IN_PROGRESS: "open",
  WAITING_ON_CUSTOMER: "pending",
  RESOLVED: "resolved",
  CLOSED: "closed",
  MERGED: "merged",
};

// Ticket priority mapping: legacy enum → new text
export const TICKET_PRIORITY_MAP: Record<string, string> = {
  P1: "p1",
  P2: "p2",
  P3: "p3",
  P4: "p4",
};

// Ticket category/type mapping: legacy enum → new text
export const TICKET_TYPE_MAP: Record<string, string> = {
  INCIDENT: "incident",
  REQUEST: "request",
  PROBLEM: "problem",
  CHANGE: "change",
};

// KB article status mapping
export const KB_STATUS_MAP: Record<string, string> = {
  draft: "draft",
  pending_review: "in_review",
  published: "published",
  archived: "archived",
};

// KB visibility mapping
export const KB_VISIBILITY_MAP: Record<string, string> = {
  public: "public",
  internal: "authenticated",
  agents_only: "restricted",
  org_only: "authenticated",
};

// Audit action → resource type
export function auditResourceType(action: string): string {
  if (action.startsWith("TICKET_")) return "ticket";
  if (action.startsWith("USER_")) return "user";
  if (action.startsWith("ORG_")) return "org";
  if (action.startsWith("MEMBERSHIP_")) return "membership";
  if (action.startsWith("EXPORT_")) return "export";
  return "unknown";
}

// Audit action → ticket event type (for synthesis)
export function auditToEventType(action: string): string | null {
  switch (action) {
    case "TICKET_STATUS_CHANGED":
      return "status_changed";
    case "TICKET_ASSIGNED":
      return "assignee_changed";
    case "TICKET_PRIORITY_CHANGED":
      return "priority_changed";
    case "TICKET_CREATED":
      return "ticket_created";
    case "TICKET_UPDATED":
      return "ticket_updated";
    default:
      return null;
  }
}

// Build a CASE expression for SQL mappings
export function sqlCase(
  column: string,
  map: Record<string, string>,
  fallback: string,
): string {
  const entries = Object.entries(map);
  if (entries.length === 0) return fallback;
  const cases = entries
    .map(([k, v]) => `WHEN '${k}' THEN '${v}'`)
    .join(" ");
  return `CASE ${column} ${cases} ELSE ${fallback} END`;
}

// Lower-case wrapper for enums that map 1:1 when lower-cased
export function sqlLower(column: string): string {
  return `LOWER(${column})`;
}
