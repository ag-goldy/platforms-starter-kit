/**
 * Job worker - processes jobs from the queue
 */

import { dequeueJob, completeJob, failJob, type Job } from './queue';
import { processSendEmailJob } from './handlers/send-email';
import { processGenerateExportJob } from './handlers/generate-export';
import { processGenerateOrgExportJob } from './handlers/generate-org-export';
import { processRecalculateSLAJob } from './handlers/recalculate-sla';
import { processAttachmentJob } from './handlers/process-attachment';
import { processAuditCompactionJob } from './handlers/audit-compaction';
import { processSLAWarningCheckJob } from './handlers/sla-warning-check';

/**
 * Process a single job
 * Handles retries with exponential backoff
 */
export async function processJob(job: Job): Promise<void> {
  // Check if job is scheduled for retry (has retryAt in future)
  const jobWithRetry = job as Job & { retryAt?: string };
  if (jobWithRetry.retryAt) {
    const retryAt = new Date(jobWithRetry.retryAt);
    if (retryAt > new Date()) {
      // Not time to retry yet, skip
      return;
    }
  }
  
  try {
    let result;
    
    switch (job.type) {
      case 'SEND_EMAIL':
        result = await processSendEmailJob(job);
        break;
      case 'GENERATE_EXPORT':
        result = await processGenerateExportJob(job);
        break;
      case 'GENERATE_ORG_EXPORT':
        result = await processGenerateOrgExportJob(job);
        break;
      case 'RECALCULATE_SLA':
        result = await processRecalculateSLAJob(job);
        break;
      case 'PROCESS_ATTACHMENT':
        result = await processAttachmentJob(job);
        break;
      case 'AUDIT_COMPACTION':
        result = await processAuditCompactionJob(job);
        break;
      case 'SLA_WARNING_CHECK':
        result = await processSLAWarningCheckJob(job);
        break;
      default:
        throw new Error(`Unknown job type: ${(job as Job).type}`);
    }

    if (result.success) {
      await completeJob(job.id, job.type, result.data);
    } else {
      await failJob(job.id, job.type, result.error || 'Job failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await failJob(job.id, job.type, errorMessage);
  }
}

/**
 * Process jobs from a queue
 * Processes up to maxJobs jobs
 */
export async function processJobs(type: Job['type'], maxJobs: number = 10): Promise<number> {
  let processed = 0;

  for (let i = 0; i < maxJobs; i++) {
    const job = await dequeueJob(type);
    if (!job) {
      break; // No more jobs
    }

    await processJob(job);
    processed++;
  }

  return processed;
}

/**
 * Process all job types
 */
export async function processAllQueues(maxJobsPerType: number = 10): Promise<{
  [key in Job['type']]: number;
}> {
  const jobTypes: Job['type'][] = [
    'SEND_EMAIL',
    'GENERATE_EXPORT',
    'GENERATE_ORG_EXPORT',
    'RECALCULATE_SLA',
    'PROCESS_ATTACHMENT',
    'AUDIT_COMPACTION',
    'SLA_WARNING_CHECK',
  ];

  const results: { [key in Job['type']]: number } = {
    SEND_EMAIL: 0,
    GENERATE_EXPORT: 0,
    GENERATE_ORG_EXPORT: 0,
    RECALCULATE_SLA: 0,
    PROCESS_ATTACHMENT: 0,
    AUDIT_COMPACTION: 0,
    SLA_WARNING_CHECK: 0,
  };

  await Promise.all(
    jobTypes.map(async (type) => {
      const count = await processJobs(type, maxJobsPerType);
      results[type] = count;
    })
  );

  return results;
}
