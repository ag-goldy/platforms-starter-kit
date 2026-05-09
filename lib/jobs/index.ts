export type { Job, JobType } from './types';

export {
  getEmailQueue,
  getExportQueue,
  getSyncQueue,
  getMaintenanceQueue,
  enqueueEmail,
  enqueueExport,
  enqueueZabbixSync,
  enqueueMaintenance,
  getQueueStats,
  cleanOldJobs,
  closeQueues,
  QUEUE_NAMES,
  type EmailJobData,
  type ExportJobData,
  type ZabbixSyncJobData,
  type MaintenanceJobData,
} from './redis-queue';

export {
  startWorkers,
  stopWorkers,
  getWorkerStatus,
  areWorkersRunning,
} from './redis-worker';

interface EnqueueOptions {
  type: JobType;
  data: unknown;
  maxAttempts?: number;
  delay?: number;
}

export async function enqueueJob(
  options: EnqueueOptions
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  if (!process.env.REDIS_URL) {
    console.error('[Jobs] REDIS_URL is not set — cannot enqueue job');
    return { success: false, error: 'Redis not configured' };
  }

  const { enqueueEmail, enqueueExport, enqueueZabbixSync, enqueueMaintenance } = await import('./redis-queue');

  switch (options.type) {
    case 'SEND_EMAIL':
      return enqueueEmail(options.data as { to: string; subject: string; html: string });

    case 'GENERATE_EXPORT':
      return enqueueExport(options.data as { orgId: string; exportType: string; format: string; userId: string }, false);

    case 'GENERATE_ORG_EXPORT':
      return enqueueExport(options.data as { orgId: string; exportType: string; format: string; userId: string }, true);

    case 'ZABBIX_SYNC':
      return enqueueZabbixSync(options.data as { orgId: string });

    case 'AUDIT_COMPACTION':
    case 'SLA_WARNING_CHECK':
    case 'RECALCULATE_SLA':
      return enqueueMaintenance({ type: options.type, ...(options.data as object) });

    default:
      return { success: false, error: `Unknown job type: ${options.type}` };
  }
}

export async function initializeWorkers(): Promise<void> {
  const { startWorkers } = await import('./redis-worker');
  startWorkers();
}

export async function shutdownWorkers(): Promise<void> {
  const { stopWorkers } = await import('./redis-worker');
  const { closeQueues } = await import('./redis-queue');
  await stopWorkers();
  await closeQueues();
}
