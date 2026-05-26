#!/usr/bin/env tsx
/**
 * Verify queued email outbox tracking end-to-end.
 *
 * Usage: npx tsx scripts/verify-queue-outbox.ts
 *
 * This script:
 * 1. Inserts a test email_outbox row with status=PENDING
 * 2. Enqueues a SEND_EMAIL job via BullMQ
 * 3. Waits for the worker to process it
 * 4. Queries the outbox row and asserts status=SENT, message_id populated, attempts=1
 * 5. Cleans up the test row
 *
 * Run against production to verify the queue path is healthy.
 */

import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getEmailQueue } from "@/lib/jobs/redis-queue";
import { startWorkers, stopWorkers } from "@/lib/jobs/redis-worker";

const TEST_EMAIL = "verify-queue-outbox@agrnetworks.com";
const TEST_SUBJECT = "Queue outbox verification";
const TEST_HTML = "<p>Verification email</p>";
const WAIT_MS = 10_000;

async function main() {
  console.log("[VerifyQueueOutbox] Starting verification...");

  // Start workers so they can process the job
  startWorkers();

  // 1. Insert test outbox row
  const [row] = await db
    .insert(emailOutbox)
    .values({
      type: "ticket_created",
      to: TEST_EMAIL,
      subject: TEST_SUBJECT,
      html: TEST_HTML,
      status: "PENDING",
      attempts: 0,
    })
    .returning();

  console.log(`[VerifyQueueOutbox] Created outbox row: ${row.id}`);

  // 2. Enqueue job
  const queue = getEmailQueue();
  const job = await queue.add("verify-queue-outbox", {
    type: "SEND_EMAIL" as const,
    to: TEST_EMAIL,
    subject: TEST_SUBJECT,
    html: TEST_HTML,
    outboxId: row.id,
  });

  console.log(`[VerifyQueueOutbox] Enqueued job: ${job.id}`);

  // 3. Wait for worker to process
  console.log(`[VerifyQueueOutbox] Waiting ${WAIT_MS}ms for worker...`);
  await new Promise((resolve) => setTimeout(resolve, WAIT_MS));

  // 4. Query and assert
  const updated = await db.query.emailOutbox.findFirst({
    where: eq(emailOutbox.id, row.id),
  });

  if (!updated) {
    throw new Error("Outbox row disappeared");
  }

  console.log("[VerifyQueueOutbox] Row state:", {
    status: updated.status,
    attempts: updated.attempts,
    messageId: updated.messageId,
    sentAt: updated.sentAt,
    lastAttemptAt: updated.lastAttemptAt,
    lastError: updated.lastError,
  });

  const assertions: string[] = [];

  if (updated.status !== "SENT") {
    assertions.push(`Expected status=SENT, got ${updated.status}`);
  }
  if (updated.attempts !== 1) {
    assertions.push(`Expected attempts=1, got ${updated.attempts}`);
  }
  if (!updated.messageId) {
    assertions.push("Expected message_id to be populated");
  }
  if (!updated.sentAt) {
    assertions.push("Expected sent_at to be populated");
  }
  if (!updated.lastAttemptAt) {
    assertions.push("Expected last_attempt_at to be populated");
  }

  // 5. Clean up
  await db.delete(emailOutbox).where(eq(emailOutbox.id, row.id));
  console.log("[VerifyQueueOutbox] Cleaned up test row");

  await stopWorkers();
  await queue.close();

  if (assertions.length > 0) {
    console.error("[VerifyQueueOutbox] FAILED:\n" + assertions.join("\n"));
    process.exit(1);
  }

  console.log("[VerifyQueueOutbox] SUCCESS — queue outbox tracking is healthy");
}

main().catch((err) => {
  console.error("[VerifyQueueOutbox] Error:", err);
  process.exit(1);
});
