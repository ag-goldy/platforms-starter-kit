import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  processedInboundEmails,
  ticketComments,
  ticketTokens,
  tickets,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.10" })),
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIP: vi.fn(() => "203.0.113.10"),
}));

vi.mock("@/lib/email/outbox", () => ({
  sendWithOutbox: vi.fn(async () => ({
    status: "SENT",
    outboxId: "test-outbox-id",
  })),
}));

vi.mock("@/lib/email/notifications", () => ({
  sendCustomerTicketCreatedNotification: vi.fn(async () => undefined),
}));

vi.mock("@microsoft/microsoft-graph-client", () => ({
  Client: {
    init: vi.fn(() => ({
      api: vi.fn(() => ({
        patch: vi.fn(async () => undefined),
      })),
    })),
    initWithMiddleware: vi.fn(() => ({
      api: vi.fn(() => ({
        patch: vi.fn(async () => undefined),
      })),
    })),
  },
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

const graphEmail = "graph-idempotency@example.com";
const genericEmail = "generic-idempotency@example.com";
const missingMessageIdEmail = "missing-message-id@example.com";
const testEmails = [graphEmail, genericEmail, missingMessageIdEmail];
const testMessageIds = [
  "<graph-idempotency@example.com>",
  "<generic-idempotency@example.com>",
];

async function cleanup() {
  const createdTickets = await db.query.tickets.findMany({
    where: inArray(tickets.requesterEmail, testEmails),
    columns: { id: true },
  });

  for (const ticket of createdTickets) {
    await db.delete(ticketTokens).where(eq(ticketTokens.ticketId, ticket.id));
    await db.delete(ticketComments).where(eq(ticketComments.ticketId, ticket.id));
    await db.delete(tickets).where(eq(tickets.id, ticket.id));
  }

  for (const messageId of testMessageIds) {
    await db
      .delete(processedInboundEmails)
      .where(eq(processedInboundEmails.internetMessageId, messageId));
  }
}

function makeGraphEmail(overrides: Record<string, unknown> = {}) {
  return {
    id: `graph-message-${Math.random().toString(36).slice(2)}`,
    subject: "Inbound idempotency test",
    from: {
      emailAddress: {
        address: graphEmail,
        name: "Graph Idempotency",
      },
    },
    toRecipients: [],
    body: {
      contentType: "text",
      content: "Graph inbound body",
    },
    receivedDateTime: new Date().toISOString(),
    internetMessageId: testMessageIds[0],
    internetMessageHeaders: [],
    conversationId: "conversation-id",
    isRead: false,
    ...overrides,
  };
}

run("inbound email idempotency", () => {
  beforeEach(async () => {
    process.env.INBOUND_EMAIL_SECRET = "test-inbound-secret";
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
  });

  it("creates only one ticket when Graph delivers the same Message-ID twice", async () => {
    const { processInboundEmail } = await import("@/lib/email/graph-inbound");

    const first = await processInboundEmail(makeGraphEmail());
    const second = await processInboundEmail(makeGraphEmail());

    expect(first.success).toBe(true);
    expect(first.ticketId).toBeTruthy();
    expect(second.success).toBe(true);
    expect(second.error).toBe("Inbound email already processed");

    const createdTickets = await db.query.tickets.findMany({
      where: eq(tickets.requesterEmail, graphEmail),
    });
    expect(createdTickets).toHaveLength(1);

    const processed = await db.query.processedInboundEmails.findFirst({
      where: eq(processedInboundEmails.internetMessageId, testMessageIds[0]),
    });
    expect(processed?.source).toBe("graph");
    expect(processed?.ticketId).toBe(createdTickets[0].id);
    expect(processed?.orgId).toBeNull();
  });

  it("creates only one ticket when generic inbound receives the same Message-ID twice", async () => {
    const { POST } = await import("@/app/api/inbound-email/route");

    const requestBody = {
      from: genericEmail,
      to: "help@example.com",
      subject: "Generic inbound idempotency test",
      text: "Generic inbound body",
      messageId: testMessageIds[1],
    };

    const first = await POST(
      new Request("http://localhost:3000/api/inbound-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-inbound-secret",
        },
        body: JSON.stringify(requestBody),
      }) as any,
    );
    const second = await POST(
      new Request("http://localhost:3000/api/inbound-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-inbound-secret",
        },
        body: JSON.stringify(requestBody),
      }) as any,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({
      success: true,
      skipped: true,
    });

    const createdTickets = await db.query.tickets.findMany({
      where: eq(tickets.requesterEmail, genericEmail),
    });
    expect(createdTickets).toHaveLength(1);

    const processed = await db.query.processedInboundEmails.findFirst({
      where: eq(processedInboundEmails.internetMessageId, testMessageIds[1]),
    });
    expect(processed?.source).toBe("generic_inbound");
    expect(processed?.ticketId).toBe(createdTickets[0].id);
    expect(processed?.orgId).toBeNull();
  });

  it("fails open and processes Graph email when Message-ID is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { processInboundEmail } = await import("@/lib/email/graph-inbound");

    const result = await processInboundEmail(
      makeGraphEmail({
        from: {
          emailAddress: {
            address: missingMessageIdEmail,
            name: "Missing Message ID",
          },
        },
        internetMessageId: undefined,
      }),
    );

    expect(result.success).toBe(true);
    expect(result.ticketId).toBeTruthy();
    expect(warnSpy).toHaveBeenCalledWith(
      "[Inbound Idempotency] No Message-ID, processing without dedup",
      { source: "graph" },
    );

    const createdTickets = await db.query.tickets.findMany({
      where: eq(tickets.requesterEmail, missingMessageIdEmail),
    });
    expect(createdTickets).toHaveLength(1);
  });
});
