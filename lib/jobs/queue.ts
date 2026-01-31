/**
 * Job queue implementation using Redis
 * 
 * Uses Redis lists for job queuing:
 * - job:queue:{type} - Pending jobs
 * - job:processing:{type} - Currently processing jobs
 * - job:failed:{type} - Failed jobs (dead letter queue)
 */

import { redis } from '@/lib/redis';
import type { Job, JobType } from './types';
export type { Job } from './types';
import { randomUUID } from 'crypto';

const QUEUE_PREFIX = 'job:queue:';
const PROCESSING_PREFIX = 'job:processing:';
const FAILED_PREFIX = 'job:failed:';
const JOB_DATA_PREFIX = 'job:data:';

/**
 * Enqueue a new job
 */
export async function enqueueJob<T extends Job>(job: Omit<T, 'id' | 'status' | 'createdAt' | 'attempts'>): Promise<string> {
  const jobId = randomUUID();
  const fullJob = {
    ...job,
    id: jobId,
    status: 'PENDING',
    createdAt: new Date(),
    attempts: 0,
    maxAttempts: job.maxAttempts || 3,
  } as unknown as Job;

  // Store job data
  await redis.set(`${JOB_DATA_PREFIX}${jobId}`, JSON.stringify(fullJob));

  // Add to queue (left push for FIFO)
  await redis.lpush(`${QUEUE_PREFIX}${job.type}`, jobId);

  return jobId;
}

/**
 * Dequeue the next job from a queue
 * Moves job from queue to processing
 */
export async function dequeueJob(type: JobType): Promise<Job | null> {
  // Move job from queue to processing (right pop from queue, left push to processing)
  const jobId = await redis.rpop<string>(`${QUEUE_PREFIX}${type}`);
  
  if (!jobId) {
    return null;
  }

  // Get job data
  const jobData = await redis.get<string>(`${JOB_DATA_PREFIX}${jobId}`);
  if (!jobData) {
    return null;
  }

  const job = JSON.parse(jobData) as Job;
  
  // Update status and move to processing
  job.status = 'PROCESSING';
  job.startedAt = new Date();
  job.attempts += 1;

  await redis.set(`${JOB_DATA_PREFIX}${jobId}`, JSON.stringify(job));
  await redis.lpush(`${PROCESSING_PREFIX}${type}`, jobId);

  return job;
}

/**
 * Mark job as completed
 */
export async function completeJob(jobId: string, type: JobType, result?: unknown): Promise<void> {
  const jobData = await redis.get<string>(`${JOB_DATA_PREFIX}${jobId}`);
  if (!jobData) {
    return;
  }

  const job = JSON.parse(jobData) as Job;
  job.status = 'COMPLETED';
  job.completedAt = new Date();
  // Store result data for retrieval
  (job as Job & { result?: unknown }).result = result;

  await redis.set(`${JOB_DATA_PREFIX}${jobId}`, JSON.stringify(job));
  
  // Remove from processing
  await redis.lrem(`${PROCESSING_PREFIX}${type}`, 1, jobId);
}

/**
 * Mark job as failed
 * Moves to failed queue if max attempts reached, otherwise schedules retry with backoff
 */
export async function failJob(jobId: string, type: JobType, error: string): Promise<void> {
  const jobData = await redis.get<string>(`${JOB_DATA_PREFIX}${jobId}`);
  if (!jobData) {
    return;
  }

  const job = JSON.parse(jobData) as Job;
  job.error = error;

  // Remove from processing
  await redis.lrem(`${PROCESSING_PREFIX}${type}`, 1, jobId);

  if (job.attempts >= job.maxAttempts) {
    // Max attempts reached, move to failed queue
    job.status = 'FAILED';
    job.completedAt = new Date();
    await redis.set(`${JOB_DATA_PREFIX}${jobId}`, JSON.stringify(job));
    await redis.lpush(`${FAILED_PREFIX}${type}`, jobId);
    
    // Also save to database for admin UI
    await saveFailedJobToDatabase(job, error);
  } else {
    // Retry: calculate backoff delay and schedule retry
    const { calculateBackoffDelay } = await import('./retry');
    const delayMs = calculateBackoffDelay(job.attempts - 1);
    const retryAt = new Date(Date.now() + delayMs);
    
    job.status = 'PENDING';
    (job as Job & { retryAt?: string }).retryAt = retryAt.toISOString();
    await redis.set(`${JOB_DATA_PREFIX}${jobId}`, JSON.stringify(job));
    
    // Add to queue - worker will check retryAt and skip if not ready
    await redis.lpush(`${QUEUE_PREFIX}${type}`, jobId);
  }
}

/**
 * Save failed job to database for admin UI
 */
async function saveFailedJobToDatabase(job: Job, error: string): Promise<void> {
  try {
    const { db } = await import('@/db');
    const { failedJobs } = await import('@/db/schema');
    
    await db.insert(failedJobs).values({
      jobId: job.id,
      type: job.type,
      data: job.data as unknown,
      error,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      failedAt: new Date(),
    });
  } catch (err) {
    // Don't fail the job failure handling if DB save fails
    console.error('Failed to save failed job to database:', err);
  }
}

/**
 * Get queue depth (number of pending jobs)
 */
export async function getQueueDepth(type: JobType): Promise<number> {
  const length = await redis.llen(`${QUEUE_PREFIX}${type}`);
  return length || 0;
}

/**
 * Get processing count (number of jobs currently processing)
 */
export async function getProcessingCount(type: JobType): Promise<number> {
  const length = await redis.llen(`${PROCESSING_PREFIX}${type}`);
  return length || 0;
}

/**
 * Get failed jobs count
 */
export async function getFailedCount(type: JobType): Promise<number> {
  const length = await redis.llen(`${FAILED_PREFIX}${type}`);
  return length || 0;
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const jobData = await redis.get<string>(`${JOB_DATA_PREFIX}${jobId}`);
  if (!jobData) {
    return null;
  }

  return JSON.parse(jobData) as Job;
}
