import { describe, it, expect } from "vitest";
import {
  ROLE_MAP,
  TICKET_STATUS_MAP,
  TICKET_PRIORITY_MAP,
  TICKET_TYPE_MAP,
  KB_STATUS_MAP,
  KB_VISIBILITY_MAP,
  auditResourceType,
  auditToEventType,
} from "@/lib/migration/transforms";

describe("migration transforms", () => {
  it("maps legacy membership roles to new roles", () => {
    expect(ROLE_MAP.ADMIN).toBe("admin");
    expect(ROLE_MAP.AGENT).toBe("agent");
    expect(ROLE_MAP.READONLY).toBe("analyst");
    expect(ROLE_MAP.CUSTOMER_ADMIN).toBe("end_user");
    expect(ROLE_MAP.REQUESTER).toBe("end_user");
    expect(ROLE_MAP.VIEWER).toBe("end_user");
  });

  it("maps legacy ticket statuses to new statuses", () => {
    expect(TICKET_STATUS_MAP.NEW).toBe("new");
    expect(TICKET_STATUS_MAP.OPEN).toBe("open");
    expect(TICKET_STATUS_MAP.IN_PROGRESS).toBe("open");
    expect(TICKET_STATUS_MAP.WAITING_ON_CUSTOMER).toBe("pending");
    expect(TICKET_STATUS_MAP.RESOLVED).toBe("resolved");
    expect(TICKET_STATUS_MAP.CLOSED).toBe("closed");
    expect(TICKET_STATUS_MAP.MERGED).toBe("merged");
  });

  it("maps legacy ticket priorities to new priorities", () => {
    expect(TICKET_PRIORITY_MAP.P1).toBe("p1");
    expect(TICKET_PRIORITY_MAP.P2).toBe("p2");
    expect(TICKET_PRIORITY_MAP.P3).toBe("p3");
    expect(TICKET_PRIORITY_MAP.P4).toBe("p4");
  });

  it("maps legacy ticket categories to new types", () => {
    expect(TICKET_TYPE_MAP.INCIDENT).toBe("incident");
    expect(TICKET_TYPE_MAP.REQUEST).toBe("request");
    expect(TICKET_TYPE_MAP.PROBLEM).toBe("problem");
    expect(TICKET_TYPE_MAP.CHANGE).toBe("change");
  });

  it("maps legacy KB statuses to new statuses", () => {
    expect(KB_STATUS_MAP.draft).toBe("draft");
    expect(KB_STATUS_MAP.pending_review).toBe("in_review");
    expect(KB_STATUS_MAP.published).toBe("published");
    expect(KB_STATUS_MAP.archived).toBe("archived");
  });

  it("maps legacy KB visibility to new visibility", () => {
    expect(KB_VISIBILITY_MAP.public).toBe("public");
    expect(KB_VISIBILITY_MAP.internal).toBe("authenticated");
    expect(KB_VISIBILITY_MAP.agents_only).toBe("restricted");
    expect(KB_VISIBILITY_MAP.org_only).toBe("authenticated");
  });

  it("derives audit resource type from action", () => {
    expect(auditResourceType("TICKET_CREATED")).toBe("ticket");
    expect(auditResourceType("USER_UPDATED")).toBe("user");
    expect(auditResourceType("ORG_DELETED")).toBe("org");
    expect(auditResourceType("MEMBERSHIP_DEACTIVATED")).toBe("membership");
    expect(auditResourceType("EXPORT_REQUESTED")).toBe("export");
    expect(auditResourceType("UNKNOWN_ACTION")).toBe("unknown");
  });

  it("derives ticket event type from audit action", () => {
    expect(auditToEventType("TICKET_STATUS_CHANGED")).toBe("status_changed");
    expect(auditToEventType("TICKET_ASSIGNED")).toBe("assignee_changed");
    expect(auditToEventType("TICKET_PRIORITY_CHANGED")).toBe(
      "priority_changed",
    );
    expect(auditToEventType("TICKET_CREATED")).toBe("ticket_created");
    expect(auditToEventType("UNKNOWN_ACTION")).toBeNull();
  });
});
