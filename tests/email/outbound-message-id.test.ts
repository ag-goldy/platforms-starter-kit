import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { emailOutbox, organizations, ticketComments, tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendWithOutbox } from "@/lib/email/outbox";

vi.mock("@/lib/email", () => ({
  emailService: {
    send: vi.fn(async () => ({
      internetMessageId: "<outbound-test-123@example.com>",
    })),
  },
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("outbound Message-ID persistence", () => {
  const testEmail = "outbound-msg-id@example.com";

  afterEach(async () => {
    if (!process.env.DATABASE_URL) return;
    await db.delete(ticketComments).where(eq(ticketComments.content, "Test outbound persistence"));
    await db.delete(tickets).where(eq(tickets.requesterEmail, testEmail));
    await db.delete(organizations).where(eq(organizations.slug, "outbound-test-org"));
    await db.delete(emailOutbox).where(eq(emailOutbox.to, testEmail));
  });

  it("writes internetMessageId to email_outbox and ticket_comments when ticketId is provided", async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        name: "Outbound Test Org",
        slug: "outbound-test-org",
        subdomain: "outbound-test",
      })
      .returning();

    const [ticket] = await db
      .insert(tickets)
      .values({
        key: "OUTB-100001",
        orgId: org.id,
        subject: "Test ticket",
        description: "Test description",
        requesterEmail: testEmail,
        status: "OPEN",
        priority: "P3",
        category: "INCIDENT",
      })
      .returning();

    const result = await sendWithOutbox({
      type: "ticket_created",
      to: testEmail,
      subject: "Test outbound persistence",
      html: "<p>Test outbound persistence</p>",
      ticketId: ticket.id,
    });

    expect(result.status).toBe("SENT");

    // Verify email_outbox has the message_id
    const outboxRows = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, testEmail),
    });
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0].messageId).toBe("<outbound-test-123@example.com>");

    // Verify ticket_comments has the outbound_message_id
    const comments = await db.query.ticketComments.findMany({
      where: eq(ticketComments.ticketId, ticket.id),
    });
    const systemComment = comments.find((c) => c.outboundMessageId === "<outbound-test-123@example.com>");
    expect(systemComment).toBeDefined();
  });

  it("creates a system comment when no existing system comment is found", async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        name: "Outbound Test Org 2",
        slug: "outbound-test-org-2",
        subdomain: "outbound-test-2",
      })
      .returning();

    const [ticket] = await db
      .insert(tickets)
      .values({
        key: "OUTB-100002",
        orgId: org.id,
        subject: "Test ticket 2",
        description: "Test description 2",
        requesterEmail: testEmail,
        status: "OPEN",
        priority: "P3",
        category: "INCIDENT",
      })
      .returning();

    await sendWithOutbox({
      type: "ticket_created",
      to: testEmail,
      subject: "Test outbound persistence",
      html: "<p>Test outbound persistence</p>",
      ticketId: ticket.id,
    });

    const comments = await db.query.ticketComments.findMany({
      where: eq(ticketComments.ticketId, ticket.id),
    });

    expect(comments.length).toBeGreaterThanOrEqual(1);
    const systemComment = comments.find((c) => c.outboundMessageId === "<outbound-test-123@example.com>");
    expect(systemComment).toBeDefined();
    expect(systemComment?.userId).toBeNull();
    expect(systemComment?.platformAdminId).toBeNull();
    expect(systemComment?.content).toBe("<p>Test outbound persistence</p>");
  });

  it("updates an existing system comment instead of creating a duplicate", async () => {
    const [org] = await db
      .insert(organizations)
      .values({
        name: "Outbound Test Org 3",
        slug: "outbound-test-org-3",
        subdomain: "outbound-test-3",
      })
      .returning();

    const [ticket] = await db
      .insert(tickets)
      .values({
        key: "OUTB-100003",
        orgId: org.id,
        subject: "Test ticket 3",
        description: "Test description 3",
        requesterEmail: testEmail,
        status: "OPEN",
        priority: "P3",
        category: "INCIDENT",
      })
      .returning();

    // Pre-create a system comment (like the initial ticket creation comment)
    const [existingComment] = await db
      .insert(ticketComments)
      .values({
        ticketId: ticket.id,
        content: "Ticket created. Submitted by: someone@example.com",
        isInternal: false,
      })
      .returning();

    await sendWithOutbox({
      type: "ticket_created",
      to: testEmail,
      subject: "Test outbound persistence",
      html: "<p>Test outbound persistence</p>",
      ticketId: ticket.id,
    });

    const comments = await db.query.ticketComments.findMany({
      where: eq(ticketComments.ticketId, ticket.id),
    });

    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe(existingComment.id);
    expect(comments[0].outboundMessageId).toBe("<outbound-test-123@example.com>");
  });
});
