'use server';

import { requireInternalAdmin } from '@/lib/auth/permissions';
import { getFailedJobs, retryFailedJob, deleteFailedJob, getFailedJobsCount } from '@/lib/jobs/dead-letter';
import type { JobType } from '@/lib/jobs/types';
import { revalidatePath } from 'next/cache';

export interface FailedJobFilters {
  type?: JobType;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get failed jobs with filters
 */
export async function getFailedJobsAction(filters: FailedJobFilters = {}) {
  await requireInternalAdmin();
  
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;
  
  const jobs = await getFailedJobs({
    type: filters.type,
    dateFrom,
    dateTo,
    limit: filters.limit || 50,
    offset: filters.offset || 0,
  });
  
  const total = await getFailedJobsCount({
    type: filters.type,
    dateFrom,
    dateTo,
  });
  
  return { jobs, total };
}

/**
 * Retry a failed job
 */
export async function retryFailedJobAction(failedJobId: string) {
  await requireInternalAdmin();
  
  try {
    const newJobId = await retryFailedJob(failedJobId);
    revalidatePath('/app/admin/jobs');
    return { success: true, jobId: newJobId, error: null };
  } catch (error) {
    return {
      success: false,
      jobId: null,
      error: error instanceof Error ? error.message : 'Failed to retry job',
    };
  }
}

/**
 * Delete a failed job
 */
export async function deleteFailedJobAction(failedJobId: string) {
  await requireInternalAdmin();
  
  try {
    await deleteFailedJob(failedJobId);
    revalidatePath('/app/admin/jobs');
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete job',
    };
  }
}

