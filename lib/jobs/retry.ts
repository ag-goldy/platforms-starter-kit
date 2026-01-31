/**
 * Job retry logic with exponential backoff
 */

import type { Job } from './types';

/**
 * Calculate exponential backoff delay in milliseconds
 * Formula: baseDelay * (2 ^ attempt)
 * 
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000 = 1 second)
 * @param maxDelayMs - Maximum delay in milliseconds (default: 300000 = 5 minutes)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 300000
): number {
  const delay = baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, maxDelayMs);
}

/**
 * Check if a job should be retried
 */
export function shouldRetry(job: Job): boolean {
  return job.attempts < job.maxAttempts;
}

/**
 * Calculate when a job should be retried (with backoff)
 * Returns the delay in milliseconds before retry
 */
export function getRetryDelay(job: Job): number {
  // Use attempts - 1 because we're about to retry (next attempt will be attempts + 1)
  return calculateBackoffDelay(job.attempts - 1);
}

/**
 * Check if a job has exceeded max attempts
 */
export function isMaxAttemptsExceeded(job: Job): boolean {
  return job.attempts >= job.maxAttempts;
}

