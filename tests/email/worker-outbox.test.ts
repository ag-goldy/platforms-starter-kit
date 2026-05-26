import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/db";
import { emailOutbox, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { processEmailJob } from "@/lib/jobs/redis-worker";
import type { Job as BullJob } from "bullmq";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("Worker outbox tracking", () => {
  const testEmail = "worker-outbox-test@example.com";

  beforeEach(async () => {
    if (!process.env.DATABASE_URL) return;
    await db.delete(emailOutbox).where(eq(emailOutbox.to, testEmail));
  });

  async function createOutboxRow(status: "PENDING" | "SENT" | "FAILED" = "PENDING") {
    const [row] = await db
      .insert(emailOutbox)
      .values({
        type: "ticket_created",
        to: testEmail,
        subject: "Worker outbox test",
        html: "<p>Test</p>",
        status,
        attempts: 0,
      })
      .returning();
    return row;
  }

  function makeJob(data: Partial<{
    to: string;
    subject: string;
    html: string;
    text?: string;
    outboxId: string;
  }>): BullJob<{ type: "SEND_EMAIL"; to: string; subject: string; html: string; outboxId: string }> {
    return {
      id: "test-job-id",
      data: {
        type: "SEND_EMAIL" as const,
        to: data.to ?? testEmail,
        subject: data.subject ?? "Worker outbox test",
        html: data.html ?? "<p>Test</p>",
        outboxId: data.outboxId ?? "00000000-0000-0000-0000-000000000000",
      },
      attemptsMade: 0,
    } as unknown as BullJob<{ type: "SEND_EMAIL"; to: string; subject: string; html: string; outboxId: string }>;
  }

  it("success path: updates outbox to SENT with message_id and sent_at", async () => {
    const { sendEmail } = await import("@/lib/email");
    vi.mocked(sendEmail).mockResolvedValueOnce({
      internetMessageId: "<test-msg-123@example.com>",
    });

    const row = await createOutboxRow("PENDING");
    const job = makeJob({ outboxId: row.id });

    const result = await processEmailJob(job);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("<test-msg-123@example.com>");

    const updated = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.id, row.id),
    });

    expect(updated?.status).toBe("SENT");
    expect(updated?.messageId).toBe("<test-msg-123@example.com>");
    expect(updated?.sentAt).not.toBeNull();
    expect(updated?.lastError).toBeNull();
  });

  it("increments attempts at start of processing", async () => {
    const { sendEmail } = await import("@/lib/email");
    vi.mocked(sendEmail).mockResolvedValueOnce({
      internetMessageId: "<test-msg-456@example.com>",
    });

    const row = await createOutboxRow("PENDING");
    const job = makeJob({ outboxId: row.id });

    await processEmailJob(job);

    const updated = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.id, row.id),
    });

    expect(updated?.attempts).toBe(1);
    expect(updated?.lastAttemptAt).not.toBeNull();
  });

  it("failure path: updates outbox to FAILED with last_error, then re-throws", async () => {
    const { sendEmail } = await import("@/lib/email");
    const errorMessage = "Graph API rejected the request";
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error(errorMessage));

    const row = await createOutboxRow("PENDING");
    const job = makeJob({ outboxId: row.id });

    await expect(processEmailJob(job)).rejects.toThrow(errorMessage);

    const updated = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.id, row.id),
    });

    expect(updated?.status).toBe("FAILED");
    expect(updated?.lastError).toBe(errorMessage);
    expect(updated?.attempts).toBe(1);
  });

  it("multiple invocations increment attempts correctly", async () => {
    const { sendEmail } = await import("@/lib/email");
    vi.mocked(sendEmail)
      .mockRejectedValueOnce(new Error("First attempt fails"))
      .mockRejectedValueOnce(new Error("Second attempt fails"))
      .mockResolvedValueOnce({ internetMessageId: "<test-msg-789@example.com>" });

    const row = await createOutboxRow("PENDING");

    // First invocation
    await expect(processEmailJob(makeJob({ outboxId: row.id }))).rejects.toThrow("First attempt fails");

    // Second invocation
    await expect(processEmailJob(makeJob({ outboxId: row.id }))).rejects.toThrow("Second attempt fails");

    // Third invocation
    const result = await processEmailJob(makeJob({ outboxId: row.id }));
    expect(result.success).toBe(true);

    const updated = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.id, row.id),
    });

    expect(updated?.attempts).toBe(3);
    expect(updated?.status).toBe("SENT");
    expect(updated?.messageId).toBe("<test-msg-789@example.com>");
  });

  it("truncates error messages longer than 1000 chars", async () => {
    const { sendEmail } = await import("@/lib/email");
    const longError = "x".repeat(1500);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error(longError));

    const row = await createOutboxRow("PENDING");
    const job = makeJob({ outboxId: row.id });

    await expect(processEmailJob(job)).rejects.toThrow();

    const updated = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.id, row.id),
    });

    expect(updated?.lastError?.length).toBe(1003); // 1000 + '...'
    expect(updated?.lastError?.endsWith("...")).toBe(true);
  });
});
