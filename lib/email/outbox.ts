import { db } from '@/db';
import { emailOutbox } from '@/db/schema';
import { emailService } from '@/lib/email';
import { desc, eq } from 'drizzle-orm';
import { enqueueJob } from '@/lib/jobs/queue';
import type { SendEmailJob } from '@/lib/jobs/types';

export type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED';

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
}) {
  const [record] = await db
    .insert(emailOutbox)
    .values({
      type: params.type,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text ?? null,
      status: 'PENDING',
      attempts: 0,
    })
    .returning();

  return record;
}

export async function deliverOutbox(record: typeof emailOutbox.$inferSelect) {
  const attempts = record.attempts + 1;

  try {
    await emailService.send({
      to: record.to,
      subject: record.subject,
      html: record.html,
      text: record.text ?? undefined,
    });

    await db
      .update(emailOutbox)
      .set({
        status: 'SENT',
        sentAt: new Date(),
        attempts,
        lastError: null,
      })
      .where(eq(emailOutbox.id, record.id));

    return { status: 'SENT' as const, outboxId: record.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(emailOutbox)
      .set({
        status: 'FAILED',
        attempts,
        lastError: message,
      })
      .where(eq(emailOutbox.id, record.id));

    console.error('[Email] Delivery failed', {
      outboxId: record.id,
      error: message,
    });

    return { status: 'FAILED' as const, error: message, outboxId: record.id };
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
}): Promise<OutboxSendResult> {
  // Store in outbox for tracking
  const record = await queueEmail(params);

  // In development or if Redis is not configured, deliver immediately
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useJobs = process.env.USE_EMAIL_JOBS !== 'false' && !isDevelopment;

  if (!useJobs) {
    // Deliver immediately (development mode or jobs disabled)
    return deliverOutbox(record);
  }

  // Enqueue background job (production)
  try {
    const job: Omit<SendEmailJob, 'id' | 'status' | 'createdAt' | 'attempts'> = {
      type: 'SEND_EMAIL',
      maxAttempts: 3,
      data: {
        type: params.type,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text ?? undefined,
      },
    };

    await enqueueJob(job);

    // Return immediately (job will be processed by worker)
    return {
      status: 'PENDING',
      outboxId: record.id,
    };
  } catch (error) {
    // If job enqueue fails, fall back to immediate delivery
    console.error('[Email] Failed to enqueue job, delivering immediately:', error);
    return deliverOutbox(record);
  }
}

export async function listFailedOutbox(limit = 20) {
  return db.query.emailOutbox.findMany({
    where: eq(emailOutbox.status, 'FAILED'),
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
