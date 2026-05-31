import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { csatSurveys, organizations, tickets, users } from "@/db/schema";
import { sql } from "drizzle-orm";

vi.mock("@/lib/auth/cron", () => ({
  verifyCronAuth: vi.fn(() => null),
}));

vi.mock("@/lib/email/outbox", () => ({
  sendWithOutbox: vi.fn(async () => ({
    status: "SENT" as const,
    outboxId: "test-outbox-id",
  })),
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("CSAT reminder cron", () => {
  async function cleanup() {
    await db.execute(
      sql.raw(`DELETE FROM csat_surveys WHERE token_hash LIKE 'test-csat-%';`),
    );
    await db.execute(
      sql.raw(`DELETE FROM tickets WHERE subject LIKE 'test-csat-%';`),
    );
    await db.execute(
      sql.raw(`DELETE FROM users WHERE email LIKE 'test-csat-%';`),
    );
    await db.execute(
      sql.raw(`DELETE FROM organizations WHERE name LIKE 'test-csat-%';`),
    );
    await db.execute(
      sql.raw(`DELETE FROM email_outbox WHERE type = 'csat_reminder';`),
    );
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  it("sends reminders to user.email via sendWithOutbox with ticketId", async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        name: `test-csat-org-${Date.now()}`,
        slug: `test-csat-org-${Date.now()}`,
        subdomain: `test-csat-org-${Date.now()}`,
      })
      .returning();

    const [user] = await db
      .insert(users)
      .values({
        email: `test-csat-user-${Date.now()}@example.com`,
        name: "CSAT Test User",
        isInternal: false,
      })
      .returning();

    const [ticket] = await db
      .insert(tickets)
      .values({
        orgId: org.id,
        key: `TEST-${Date.now()}`,
        subject: `test-csat-ticket-${Date.now()}`,
        description: "Test ticket for CSAT",
        status: "RESOLVED",
        priority: "P3",
        category: "INCIDENT",
        requesterId: user.id,
      })
      .returning();

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    await db.insert(csatSurveys).values({
      ticketId: ticket.id,
      orgId: org.id,
      requesterId: user.id,
      tokenHash: `test-csat-token-${Date.now()}`,
      sentAt: fourDaysAgo,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      reminderCount: 0,
    });

    const { GET } = await import("@/app/api/cron/csat-reminders/route");
    const res = await GET(new Request("http://localhost/api/cron/csat-reminders") as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.total).toBe(1);
    expect(body.sent).toBe(1);
    expect(body.skipped_no_recipient).toBe(0);
    expect(body.errors).toBe(0);

    // Verify sendWithOutbox was called with email (not UUID) and ticketId
    const { sendWithOutbox } = await import("@/lib/email/outbox");
    expect(sendWithOutbox).toHaveBeenCalledTimes(1);
    const call = (sendWithOutbox as any).mock.calls[0][0];
    expect(call.to).toBe(user.email);
    expect(call.type).toBe("csat_reminder");
    expect(call.ticketId).toBe(ticket.id);
    expect(call.to).not.toBe(user.id); // must not be the UUID
  });

  it("skips surveys where requesterEmail is null (deleted user)", async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        name: `test-csat-org2-${Date.now()}`,
        slug: `test-csat-org2-${Date.now()}`,
        subdomain: `test-csat-org2-${Date.now()}`,
      })
      .returning();

    const [ticket] = await db
      .insert(tickets)
      .values({
        orgId: org.id,
        key: `TEST2-${Date.now()}`,
        subject: `test-csat-ticket2-${Date.now()}`,
        description: "Test ticket for CSAT",
        status: "RESOLVED",
        priority: "P3",
        category: "INCIDENT",
      })
      .returning();

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    // requesterId is null → requesterEmail will be null after left join
    await db.insert(csatSurveys).values({
      ticketId: ticket.id,
      orgId: org.id,
      requesterId: null,
      tokenHash: `test-csat-token2-${Date.now()}`,
      sentAt: fourDaysAgo,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      reminderCount: 0,
    });

    const { GET } = await import("@/app/api/cron/csat-reminders/route");
    const res = await GET(new Request("http://localhost/api/cron/csat-reminders") as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.total).toBe(1);
    expect(body.sent).toBe(0);
    expect(body.skipped_no_recipient).toBe(1);
    expect(body.errors).toBe(0);

    // sendWithOutbox should not have been called
    const { sendWithOutbox } = await import("@/lib/email/outbox");
    expect(sendWithOutbox).not.toHaveBeenCalled();
  });

  it("returns total: 0 when no surveys are due", async () => {
    const { GET } = await import("@/app/api/cron/csat-reminders/route");
    const res = await GET(new Request("http://localhost/api/cron/csat-reminders") as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.total).toBe(0);
    expect(body.sent).toBe(0);
    expect(body.skipped_no_recipient).toBe(0);
    expect(body.errors).toBe(0);
  });

  it("does not select surveys with reminderCount > maxReminders", async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        name: `test-csat-org3-${Date.now()}`,
        slug: `test-csat-org3-${Date.now()}`,
        subdomain: `test-csat-org3-${Date.now()}`,
      })
      .returning();

    const [user] = await db
      .insert(users)
      .values({
        email: `test-csat-user3-${Date.now()}@example.com`,
        name: "CSAT Test User",
        isInternal: false,
      })
      .returning();

    const [ticket] = await db
      .insert(tickets)
      .values({
        orgId: org.id,
        key: `TEST3-${Date.now()}`,
        subject: `test-csat-ticket3-${Date.now()}`,
        description: "Test ticket for CSAT",
        status: "RESOLVED",
        priority: "P3",
        category: "INCIDENT",
        requesterId: user.id,
      })
      .returning();

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    // reminderCount = 3 > maxReminders (2)
    await db.insert(csatSurveys).values({
      ticketId: ticket.id,
      orgId: org.id,
      requesterId: user.id,
      tokenHash: `test-csat-token3-${Date.now()}`,
      sentAt: fourDaysAgo,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      reminderCount: 3,
    });

    const { GET } = await import("@/app/api/cron/csat-reminders/route");
    const res = await GET(new Request("http://localhost/api/cron/csat-reminders") as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.sent).toBe(0);
  });

  it("increments error counter and continues when sendWithOutbox throws", async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        name: `test-csat-org4-${Date.now()}`,
        slug: `test-csat-org4-${Date.now()}`,
        subdomain: `test-csat-org4-${Date.now()}`,
      })
      .returning();

    const [user] = await db
      .insert(users)
      .values({
        email: `test-csat-user4-${Date.now()}@example.com`,
        name: "CSAT Test User",
        isInternal: false,
      })
      .returning();

    const [ticket] = await db
      .insert(tickets)
      .values({
        orgId: org.id,
        key: `TEST4-${Date.now()}`,
        subject: `test-csat-ticket4-${Date.now()}`,
        description: "Test ticket for CSAT",
        status: "RESOLVED",
        priority: "P3",
        category: "INCIDENT",
        requesterId: user.id,
      })
      .returning();

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    await db.insert(csatSurveys).values({
      ticketId: ticket.id,
      orgId: org.id,
      requesterId: user.id,
      tokenHash: `test-csat-token4-${Date.now()}`,
      sentAt: fourDaysAgo,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      reminderCount: 0,
    });

    // Make sendWithOutbox throw
    const { sendWithOutbox } = await import("@/lib/email/outbox");
    (sendWithOutbox as any).mockRejectedValueOnce(new Error("Graph API down"));

    const { GET } = await import("@/app/api/cron/csat-reminders/route");
    const res = await GET(new Request("http://localhost/api/cron/csat-reminders") as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.total).toBe(1);
    expect(body.sent).toBe(0);
    expect(body.errors).toBe(1);
  });
});
