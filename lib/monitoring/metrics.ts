/**
 * Metrics collection for observability
 * 
 * Tracks latency, success rates, queue depth, volume, and error rates
 */

// import { redis } from '@/lib/redis'; // TODO: Use for metrics storage
import { getQueueDepth, getProcessingCount, getFailedCount } from '@/lib/jobs/queue';
import type { JobType } from '@/lib/jobs/types';
import { db } from '@/db';
import { tickets, emailOutbox } from '@/db/schema';
import { gte, sql, count } from 'drizzle-orm';

export interface Metrics {
  timestamp: Date;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  email: {
    successRate: number;
    totalSent: number;
    totalFailed: number;
  };
  queue: {
    pending: { [key: string]: number };
    processing: { [key: string]: number };
    failed: { [key: string]: number };
  };
  tickets: {
    created24h: number;
    resolved24h: number;
    openCount: number;
  };
  errors: {
    rate24h: number;
  };
}

// In-memory latency tracking (in production, use Redis or a metrics service)
const latencySamples: number[] = [];
const MAX_SAMPLES = 1000;

/**
 * Record a latency measurement
 */
export function recordLatency(ms: number): void {
  latencySamples.push(ms);
  if (latencySamples.length > MAX_SAMPLES) {
    latencySamples.shift();
  }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
}

/**
 * Get current metrics snapshot
 */
export async function getMetrics(): Promise<Metrics> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Calculate latency percentiles
  const sortedLatencies = [...latencySamples].sort((a, b) => a - b);
  const latency = {
    p50: percentile(sortedLatencies, 50),
    p95: percentile(sortedLatencies, 95),
    p99: percentile(sortedLatencies, 99),
  };

  // Email metrics
  const emailStats = await db
    .select({
      total: count(),
      sent: sql<number>`COUNT(CASE WHEN ${emailOutbox.status} = 'SENT' THEN 1 END)`,
      failed: sql<number>`COUNT(CASE WHEN ${emailOutbox.status} = 'FAILED' THEN 1 END)`,
    })
    .from(emailOutbox)
    .where(gte(emailOutbox.createdAt, yesterday));

  const emailTotal = Number(emailStats[0]?.total || 0);
  const emailSent = Number(emailStats[0]?.sent || 0);
  const emailFailed = Number(emailStats[0]?.failed || 0);
  const emailSuccessRate = emailTotal > 0 ? (emailSent / emailTotal) * 100 : 100;

  // Queue metrics
  const queuePending: { [key: string]: number } = {};
  const queueProcessing: { [key: string]: number } = {};
  const queueFailed: { [key: string]: number } = {};

  const jobTypes: JobType[] = [
    'SEND_EMAIL',
    'GENERATE_EXPORT',
    'GENERATE_ORG_EXPORT',
    'RECALCULATE_SLA',
    'PROCESS_ATTACHMENT',
    'AUDIT_COMPACTION',
  ];
  for (const type of jobTypes) {
    queuePending[type] = await getQueueDepth(type);
    queueProcessing[type] = await getProcessingCount(type);
    queueFailed[type] = await getFailedCount(type);
  }

  // Ticket metrics
  const ticketStats = await db
    .select({
      created: sql<number>`COUNT(CASE WHEN ${tickets.createdAt} >= ${yesterday} THEN 1 END)`,
      resolved: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} >= ${yesterday} AND ${tickets.resolvedAt} IS NOT NULL THEN 1 END)`,
      open: sql<number>`COUNT(CASE WHEN ${tickets.status} IN ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER') THEN 1 END)`,
    })
    .from(tickets);

  const ticketsCreated24h = Number(ticketStats[0]?.created || 0);
  const ticketsResolved24h = Number(ticketStats[0]?.resolved || 0);
  const ticketsOpen = Number(ticketStats[0]?.open || 0);

  // Error rate (simplified - in production, track from error logs)
  const errorRate24h = 0; // TODO: Implement error tracking

  return {
    timestamp: now,
    latency,
    email: {
      successRate: emailSuccessRate,
      totalSent: emailSent,
      totalFailed: emailFailed,
    },
    queue: {
      pending: queuePending,
      processing: queueProcessing,
      failed: queueFailed,
    },
    tickets: {
      created24h: ticketsCreated24h,
      resolved24h: ticketsResolved24h,
      openCount: ticketsOpen,
    },
    errors: {
      rate24h: errorRate24h,
    },
  };
}

/**
 * Reset latency samples (useful for testing)
 */
export function resetLatencySamples(): void {
  latencySamples.length = 0;
}
