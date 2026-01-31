/**
 * Handler for SEND_EMAIL jobs
 * Includes idempotency check to prevent duplicate sends
 */

import type { SendEmailJob } from '../types';
import type { JobResult } from '../types';
import { emailService } from '@/lib/email';
import { db } from '@/db';
import { emailOutbox } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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
    
    await emailService.send({
      to: job.data.to,
      subject: job.data.subject,
      html: job.data.html,
      text: job.data.text,
    });

    return {
      success: true,
      data: { idempotent: false },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
