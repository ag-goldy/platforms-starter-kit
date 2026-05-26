/**
 * Handler for SEND_EMAIL jobs
 * Includes idempotency check to prevent duplicate sends
 */

import type { SendEmailJob } from '../types';
import type { JobResult } from '../types';
import { emailService } from '@/lib/email';
import { db } from '@/db';
import { emailOutbox, ticketComments } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function processSendEmailJob(job: SendEmailJob): Promise<JobResult> {
  try {
    // Idempotency check: Check if this email was already sent successfully
    // Check for recent successful send (within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await db.query.emailOutbox.findFirst({
      where: and(
        eq(emailOutbox.to, job.data.to),
        eq(emailOutbox.subject, job.data.subject),
        // Check if sent recently
        // Note: emailOutbox doesn't have sentAt in where clause, so we'll check status
      ),
      orderBy: (outbox, { desc }) => [desc(outbox.createdAt)],
    });

    // If email was already sent successfully in the last hour, skip
    if (existing && existing.status === 'SENT' && existing.createdAt > oneHourAgo) {
      return {
        success: true,
        data: { idempotent: true, message: 'Email already sent' },
      };
    }

    const sendResult = await emailService.send({
      to: job.data.to,
      subject: job.data.subject,
      html: job.data.html,
      text: job.data.text,
    });

    const internetMessageId = sendResult.internetMessageId ?? null;

    // Persist outbound Message-ID to ticket_comments for reply threading
    if (job.data.ticketId && internetMessageId) {
      await persistOutboundMessageId(job.data.ticketId, internetMessageId, job.data.html);
    }

    return {
      success: true,
      data: { idempotent: false, internetMessageId },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
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
      return;
    }

    await db.insert(ticketComments).values({
      ticketId,
      content: body,
      isInternal: false,
      outboundMessageId: internetMessageId,
    });
  } catch (err) {
    console.error(
      `[SendEmailJob] Failed to persist outbound_message_id for ticket ${ticketId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
