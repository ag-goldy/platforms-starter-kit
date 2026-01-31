/**
 * Dead-letter queue management
 * 
 * Functions for managing permanently failed jobs
 */

import { db } from '@/db';
import { failedJobs } from '@/db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { enqueueJob } from './queue';
import type { Job, JobType } from './types';

export interface FailedJobFilters {
  type?: JobType;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Get failed jobs with filters
 */
export async function getFailedJobs(filters: FailedJobFilters = {}) {
  const { type, dateFrom, dateTo, limit = 50, offset = 0 } = filters;
  
  const conditions = [];
  if (type) {
    conditions.push(eq(failedJobs.type, type));
  }
  if (dateFrom) {
    conditions.push(gte(failedJobs.failedAt, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(failedJobs.failedAt, dateTo));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db
    .select()
    .from(failedJobs)
    .where(whereClause)
    .orderBy(desc(failedJobs.failedAt))
    .limit(limit)
    .offset(offset);
  
  return results;
}

/**
 * Get failed job by ID
 */
export async function getFailedJobById(id: string) {
  const [job] = await db
    .select()
    .from(failedJobs)
    .where(eq(failedJobs.id, id))
    .limit(1);
  
  return job || null;
}

/**
 * Retry a failed job
 * Re-enqueues the job with fresh attempt count
 */
export async function retryFailedJob(id: string): Promise<string> {
  const failedJob = await getFailedJobById(id);
  if (!failedJob) {
    throw new Error('Failed job not found');
  }
  
  // Re-enqueue the job
  const jobId = await enqueueJob({
    type: failedJob.type as JobType,
    data: failedJob.data as Job['data'],
    maxAttempts: failedJob.maxAttempts,
  });
  
  // Update retriedAt timestamp
  await db
    .update(failedJobs)
    .set({ retriedAt: new Date() })
    .where(eq(failedJobs.id, id));
  
  return jobId;
}

/**
 * Delete a failed job
 */
export async function deleteFailedJob(id: string): Promise<void> {
  await db.delete(failedJobs).where(eq(failedJobs.id, id));
}

/**
 * Get failed jobs count by type
 */
export async function getFailedJobsCount(filters: FailedJobFilters = {}) {
  const { type, dateFrom, dateTo } = filters;
  
  const conditions = [];
  if (type) {
    conditions.push(eq(failedJobs.type, type));
  }
  if (dateFrom) {
    conditions.push(gte(failedJobs.failedAt, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(failedJobs.failedAt, dateTo));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const results = await db
    .select({ count: failedJobs.id })
    .from(failedJobs)
    .where(whereClause);
  return results.length;
}
