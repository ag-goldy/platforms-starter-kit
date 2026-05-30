import { db } from "@/db";
import { emailOutbox, ticketComments } from "@/db/schema";
import { emailService } from "@/lib/email";
import { desc, eq, and, isNull } from "drizzle-orm";
import { enqueueJob } from "@/lib/jobs";
import type { SendEmailJob } from "@/lib/jobs/types";

export type OutboxStatus = "PENDING" | "SENT" | "FAILED";

export type OutboxSendResult = {
  status: OutboxStatus;
  error?: string | null;
  outboxId: string;
};

export async function queueEmail(params: {
  type: string;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  ticketId?: string;
}) {
  const [record] = await db
    .insert(emailOutbox)
    .values({
      type: params.type,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text ?? null,
      status: "PENDING",
      attempts: 0,
      ticketId: params.ticketId ?? null,
    })
    .returning();

  return record;
}

export async function deliverOutbox(
  record: typeof emailOutbox.$inferSelect,
  ticketId?: string,
) {
  const attempts = record.attempts + 1;

  try {
    const sendResult = await emailService.send({
      to: record.to,
      subject: record.subject,
      html: record.html,
      text: record.text ?? undefined,
    });

    const internetMessageId = sendResult.internetMessageId ?? null;

    await db
      .update(emailOutbox)
      .set({
        status: "SENT",
        sentAt: new Date(),
        attempts,
        lastError: null,
        messageId: internetMessageId,
      })
      .where(eq(emailOutbox.id, record.id));

    // Persist outbound Message-ID to ticket_comments for reply threading
    if (ticketId && internetMessageId) {
      await persistOutboundMessageId(ticketId, internetMessageId, record.html);
    }

    return { status: "SENT" as const, outboxId: record.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(emailOutbox)
      .set({
        status: "FAILED",
        attempts,
        lastError: message,
      })
      .where(eq(emailOutbox.id, record.id));

    console.error("[Email] Delivery failed", {
      outboxId: record.id,
      error: message,
    });

    return { status: "FAILED" as const, error: message, outboxId: record.id };
  }
}

/**
 * Persist outbound Message-ID to ticket_comments for reply threading.
 * Tries to update an existing system comment first; creates one if none exists.
 */
async function persistOutboundMessageId(
  ticketId: string,
  internetMessageId: string,
  body: string,
) {
  try {
    // Look for an existing system comment on this ticket without an outbound_message_id
    const existing = await db.query.ticketComments.findFirst({
      where: and(
        eq(ticketComments.ticketId, ticketId),
        isNull(ticketComments.userId),
        isNull(ticketComments.platformAdminId),
        isNull(ticketComments.outboundMessageId),
      ),
    });

    if (existing) {
      await db
        .update(ticketComments)
        .set({ outboundMessageId: internetMessageId })
        .where(eq(ticketComments.id, existing.id));
      console.log(
        `[Outbox] Updated comment ${existing.id} with outbound_message_id ${internetMessageId}`,
      );
      return;
    }

    // No existing system comment; create one
    const [comment] = await db
      .insert(ticketComments)
      .values({
        ticketId,
        content: body,
        isInternal: false,
        outboundMessageId: internetMessageId,
      })
      .returning();

    console.log(
      `[Outbox] Created comment ${comment.id} with outbound_message_id ${internetMessageId}`,
    );
  } catch (err) {
    console.error(
      `[Outbox] Failed to persist outbound_message_id for ticket ${ticketId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Send email via background job
 * Returns immediately after enqueueing the job
 * In development, falls back to immediate delivery if job queue fails
 */
export async function sendWithOutbox(params: {
  type: string;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  ticketId?: string;
}): Promise<OutboxSendResult> {
  // Store in outbox for tracking
  const record = await queueEmail(params);

  // In development or if Redis is not configured, deliver immediately
  const isDevelopment = process.env.NODE_ENV === "development";
  const alwaysImmediate = [
    "password_reset",
    "password_reset_confirmation",
    "email_digest",
  ].includes(params.type);
  const useJobs =
    !alwaysImmediate &&
    process.env.USE_EMAIL_JOBS !== "false" &&
    !isDevelopment;

  if (!useJobs) {
    // Deliver immediately (development mode or jobs disabled)
    return deliverOutbox(record, params.ticketId);
  }

  // Enqueue background job (production)
  try {
    const job: Omit<SendEmailJob, "id" | "status" | "createdAt" | "attempts"> =
      {
        type: "SEND_EMAIL",
        maxAttempts: 3,
        data: {
          type: params.type,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text ?? undefined,
          ticketId: params.ticketId,
          outboxId: record.id,
        },
      };

    await enqueueJob({
      type: job.type,
      maxAttempts: job.maxAttempts,
      data: job.data,
    });

    // Return immediately (job will be processed by worker)
    return {
      status: "PENDING",
      outboxId: record.id,
    };
  } catch (error) {
    // If job enqueue fails, fall back to immediate delivery
    console.error(
      "[Email] Failed to enqueue job, delivering immediately:",
      error,
    );
    return deliverOutbox(record, params.ticketId);
  }
}

export async function listFailedOutbox(limit = 20) {
  return db.query.emailOutbox.findMany({
    where: eq(emailOutbox.status, "FAILED"),
    orderBy: [desc(emailOutbox.createdAt)],
    limit,
  });
}

export async function retryOutbox(id: string) {
  const record = await db.query.emailOutbox.findFirst({
    where: eq(emailOutbox.id, id),
  });

  if (!record) {
    return null;
  }

  return deliverOutbox(record);
}
