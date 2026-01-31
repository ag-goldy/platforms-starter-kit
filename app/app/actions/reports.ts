'use server';

import { requireInternalRole } from '@/lib/auth/permissions';
import { generateReport, type ReportFilters } from '@/lib/reports/queries';
import { enqueueJob } from '@/lib/jobs/queue';

export async function generateReportAction(filters: ReportFilters) {
  await requireInternalRole();
  return await generateReport(filters);
}

export async function exportReportCSVAction(filters: ReportFilters) {
  const user = await requireInternalRole();
  
  // Enqueue export job instead of generating synchronously
  const jobId = await enqueueJob({
    type: 'GENERATE_EXPORT',
    maxAttempts: 3,
    data: {
      format: 'CSV' as const,
      filters,
      userId: user.id,
    },
  });

  return { jobId, status: 'PENDING' };
}

export async function exportReportJSONAction(filters: ReportFilters) {
  const user = await requireInternalRole();
  
  // Enqueue export job instead of generating synchronously
  const jobId = await enqueueJob({
    type: 'GENERATE_EXPORT',
    maxAttempts: 3,
    data: {
      format: 'JSON' as const,
      filters,
      userId: user.id,
    },
  });

  return { jobId, status: 'PENDING' };
}

export async function getExportJobStatusAction(jobId: string) {
  await requireInternalRole();
  const { getJob } = await import('@/lib/jobs/queue');
  const job = await getJob(jobId);
  
  if (!job) {
    return { status: 'NOT_FOUND' as const };
  }

  const result = (job as { result?: { downloadUrl?: string; filename?: string } }).result;
  return {
    status: job.status,
    downloadUrl: job.status === 'COMPLETED' && result?.downloadUrl 
      ? result.downloadUrl 
      : null,
    filename: result?.filename || null,
    error: job.error || null,
  };
}
