import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { emailOutbox, ticketComments, ticketTokens, tickets } from "@/db/schema";
import { eq } from "drizzle-orm";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.10" })),
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIP: vi.fn(() => "203.0.113.10"),
  rateLimit: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("@/lib/email", () => ({
  emailService: {
    send: vi.fn(async () => undefined),
  },
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("public support ticket outbox tracking", () => {
  const testEmail = "public-ticket-outbox@example.com";

  afterEach(async () => {
    if (!process.env.DATABASE_URL) return;

    const createdTickets = await db.query.tickets.findMany({
      where: eq(tickets.requesterEmail, testEmail),
      columns: { id: true },
    });

    for (const ticket of createdTickets) {
      await db.delete(ticketTokens).where(eq(ticketTokens.ticketId, ticket.id));
      await db.delete(ticketComments).where(eq(ticketComments.ticketId, ticket.id));
      await db.delete(tickets).where(eq(tickets.id, ticket.id));
    }

    await db.delete(emailOutbox).where(eq(emailOutbox.to, testEmail));
  });

  it("creates an email_outbox row for the confirmation email", async () => {
    const { POST } = await import("@/app/api/support/tickets/route");
    const response = await POST(
      new Request("http://localhost:3000/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          name: "Public Outbox Test",
          subject: "Public ticket outbox tracking",
          description: "Verify public ticket confirmation emails use sendWithOutbox.",
        }),
      }) as any,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.ticket.key).toMatch(/^SUP-\d{6}$/);

    const rows = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, testEmail),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("ticket_created");
    expect(rows[0].subject).toBe(`[${body.ticket.key}] Ticket received`);
    expect(["PENDING", "SENT"]).toContain(rows[0].status);
  });
});
