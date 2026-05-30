import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { emailOutbox, organizations, tickets } from "@/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/jobs", () => ({
  enqueueJob: vi.fn(async () => ({ success: true, jobId: "automation-email-job" })),
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("automation email outbox tracking", () => {
  const testEmail = "automation-action-outbox@example.com";
  const orgSlug = "automation-email-outbox-org";
  const originalUseEmailJobs = process.env.USE_EMAIL_JOBS;

  afterEach(async () => {
    if (!process.env.DATABASE_URL) return;
    await db.delete(emailOutbox).where(eq(emailOutbox.to, testEmail));
    await db.delete(tickets).where(eq(tickets.requesterEmail, testEmail));
    await db.delete(organizations).where(eq(organizations.slug, orgSlug));
    process.env.USE_EMAIL_JOBS = originalUseEmailJobs;
  });

  it("queues automation send_email actions with ticket_id in email_outbox", async () => {
    process.env.USE_EMAIL_JOBS = "true";
    const { executeActions } = await import("@/lib/automation/actions");

    const [org] = await db
      .insert(organizations)
      .values({
        name: "Automation Email Outbox Org",
        slug: orgSlug,
        subdomain: "automation-email-outbox",
      })
      .returning();

    const [ticket] = await db
      .insert(tickets)
      .values({
        key: "AUTO-100001",
        orgId: org.id,
        subject: "Automation email test",
        description: "Verify automation emails use outbox tracking.",
        requesterEmail: testEmail,
        status: "NEW",
        priority: "P3",
        category: "INCIDENT",
      })
      .returning();

    const result = await executeActions(
      [
        {
          type: "send_email",
          value: testEmail,
          subject: "Automation notice",
          template: "Automation body",
        },
      ],
      { ticketId: ticket.id, orgId: org.id },
    );

    expect(result).toEqual({ executed: 1, errors: [] });

    const rows = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, testEmail),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("automation_action");
    expect(rows[0].ticketId).toBe(ticket.id);
    expect(rows[0].status).toBe("PENDING");
    expect(rows[0].subject).toBe("Automation notice");
    expect(rows[0].text).toBe("Automation body");
    expect(rows[0].html).toBe("<p>Automation body</p>");
  });
});
