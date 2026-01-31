/**
 * Operations metrics for the Ops dashboard
 */

import { listFailedOutbox } from '@/lib/email/outbox';
import { getFailedJobs, getFailedJobsCount } from '@/lib/jobs/dead-letter';
import { db } from '@/db';
import { tickets, attachments } from '@/db/schema';
import { eq, and, sql, isNotNull } from 'drizzle-orm';

export interface OpsMetrics {
  failedEmails: {
    count: number;
    recent: Array<{
      id: string;
      to: string;
      subject: string;
      lastError: string | null;
      attempts: number;
      createdAt: Date;
    }>;
  };
  failedJobs: {
    count: number;
    recent: Array<{
      id: string;
      jobId: string;
      type: string;
      error: string;
      attempts: number;
      failedAt: Date;
    }>;
  };
  slaBreaches: {
    count: number;
    recent: Array<{
      id: string;
      key: string;
      subject: string;
      priority: string;
      slaResponseTargetHours: number | null;
      slaResolutionTargetHours: number | null;
      createdAt: Date;
      firstResponseAt: Date | null;
    }>;
  };
  quarantinedAttachments: {
    count: number;
    recent: Array<{
      id: string;
      filename: string;
      scanResult: string | null;
      scannedAt: Date | null;
      createdAt: Date;
    }>;
  };
  automationFailures: {
    count: number;
    // Note: Automation failures aren't currently tracked in the database
    // This is a placeholder for future implementation
    recent: Array<unknown>;
  };
}

/**
 * Get all operational metrics for the dashboard
 */
export async function getOpsMetrics(): Promise<OpsMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Failed emails
  const failedEmails = await listFailedOutbox(10);
  
  // Failed jobs (last 24 hours)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const failedJobs = await getFailedJobs({
    dateFrom: yesterday,
    limit: 10,
  });
  const failedJobsCount = await getFailedJobsCount({
    dateFrom: yesterday,
  });
  
  // SLA breaches today (tickets with breached SLA that are still open)
  // Note: SLA due dates are calculated, not stored, so we'll use a simplified check
  // based on target hours and ticket age
  const openTickets = await db
    .select({
      id: tickets.id,
      key: tickets.key,
      subject: tickets.subject,
      priority: tickets.priority,
      slaResponseTargetHours: tickets.slaResponseTargetHours,
      slaResolutionTargetHours: tickets.slaResolutionTargetHours,
      createdAt: tickets.createdAt,
      firstResponseAt: tickets.firstResponseAt,
    })
    .from(tickets)
    .where(
      sql`${tickets.status} NOT IN ('RESOLVED', 'CLOSED')`
    )
    .limit(100);
  
  // Filter to tickets that have breached SLA
  const slaBreaches = openTickets.filter((ticket) => {
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
    
    // Check response SLA breach
    if (ticket.slaResponseTargetHours && !ticket.firstResponseAt) {
      if (hoursSinceCreation > ticket.slaResponseTargetHours) {
        return true;
      }
    }
    
    // Check resolution SLA breach
    if (ticket.slaResolutionTargetHours) {
      if (hoursSinceCreation > ticket.slaResolutionTargetHours) {
        return true;
      }
    }
    
    return false;
  }).slice(0, 20);
  
  // Quarantined attachments
  const quarantinedAttachments = await db
    .select({
      id: attachments.id,
      filename: attachments.filename,
      scanResult: attachments.scanResult,
      scannedAt: attachments.scannedAt,
      createdAt: attachments.createdAt,
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.isQuarantined, true),
        isNotNull(attachments.scannedAt)
      )
    )
    .orderBy(sql`${attachments.scannedAt} DESC`)
    .limit(10);
  
  const quarantinedCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(attachments)
    .where(eq(attachments.isQuarantined, true));
  
  return {
    failedEmails: {
      count: failedEmails.length,
      recent: failedEmails.map((email) => ({
        id: email.id,
        to: email.to,
        subject: email.subject,
        lastError: email.lastError,
        attempts: email.attempts,
        createdAt: email.createdAt,
      })),
    },
    failedJobs: {
      count: failedJobsCount,
      recent: failedJobs.map((job) => ({
        id: job.id,
        jobId: job.jobId,
        type: job.type,
        error: job.error,
        attempts: job.attempts,
        failedAt: job.failedAt,
      })),
    },
    slaBreaches: {
      count: slaBreaches.length,
      recent: slaBreaches,
    },
    quarantinedAttachments: {
      count: quarantinedCount[0]?.count || 0,
      recent: quarantinedAttachments,
    },
    automationFailures: {
      count: 0, // Not currently tracked
      recent: [],
    },
  };
}
