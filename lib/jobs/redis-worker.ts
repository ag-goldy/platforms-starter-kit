/**
 * BullMQ Workers - Process jobs from Redis queues
 * 
 * Each worker handles a specific queue:
 * - Email worker: Sends emails via Microsoft Graph API
 * - Export worker: Generates export files and uploads to Blob storage
 * - Sync worker: Runs Zabbix synchronization
 * - Maintenance worker: Audit compaction, SLA checks
 */

import { Worker, Job as BullJob } from 'bullmq';
import { QUEUE_NAMES, EmailJobData, ExportJobData, ZabbixSyncJobData, MaintenanceJobData } from './redis-queue';

// Redis connection (same as queue)
const getConnection = () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  };
};

// Worker instances
let emailWorker: Worker<EmailJobData> | null = null;
let exportWorker: Worker<ExportJobData> | null = null;
let syncWorker: Worker<ZabbixSyncJobData> | null = null;
let maintenanceWorker: Worker<MaintenanceJobData> | null = null;

// Track worker status
const workerStatus = new Map<string, 'running' | 'stopped' | 'error'>();

/**
 * Process email job
 */
async function processEmailJob(job: BullJob<EmailJobData>): Promise<{ success: boolean; messageId?: string }> {
  console.log(`[Worker:Email] Processing job ${job.id}: ${job.data.subject}`);
  
  try {
    // Import email service dynamically to avoid circular deps
    const { sendEmail } = await import('@/lib/email');
    
    const result = await sendEmail({
      to: job.data.to,
      subject: job.data.subject,
      html: job.data.html,
      text: job.data.text,
      replyTo: job.data.replyTo,
      attachments: job.data.attachments,
    });

    if (result.success) {
      console.log(`[Worker:Email] Job ${job.id} completed: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } else {
      throw new Error(result.error || 'Email send failed');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Worker:Email] Job ${job.id} failed:`, message);
    throw error; // Re-throw to trigger BullMQ retry
  }
}

/**
 * Process export job
 */
async function processExportJob(job: BullJob<ExportJobData>): Promise<{ success: boolean; blobUrl?: string }> {
  console.log(`[Worker:Export] Processing job ${job.id}: ${job.data.exportType} export for org ${job.data.orgId}`);
  
  try {
    // Import export handlers dynamically
    if (job.data.type === 'GENERATE_ORG_EXPORT') {
      const { processGenerateOrgExportJob } = await import('./handlers/generate-org-export');
      const result = await processGenerateOrgExportJob({
        id: job.id!,
        type: 'GENERATE_ORG_EXPORT',
        data: {
          exportRequestId: job.data.filters?.exportRequestId as string || '',
          orgId: job.data.orgId,
          requestedById: job.data.userId,
        },
        status: 'PROCESSING',
        createdAt: new Date(job.timestamp),
        attempts: job.attemptsMade,
        maxAttempts: 2,
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }
      return { success: true };
    } else {
      const { processGenerateExportJob } = await import('./handlers/generate-export');
      const result = await processGenerateExportJob({
        id: job.id!,
        type: 'GENERATE_EXPORT',
        data: {
          format: job.data.format === 'csv' ? 'CSV' : 'JSON',
          filters: job.data.filters || {},
          userId: job.data.userId,
          orgId: job.data.orgId,
        },
        status: 'PROCESSING',
        createdAt: new Date(job.timestamp),
        attempts: job.attemptsMade,
        maxAttempts: 2,
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }
      return { success: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Worker:Export] Job ${job.id} failed:`, message);
    throw error;
  }
}

/**
 * Process Zabbix sync job
 */
async function processSyncJob(job: BullJob<ZabbixSyncJobData>): Promise<{ success: boolean; syncedCount?: number }> {
  console.log(`[Worker:Sync] Processing job ${job.id}: Zabbix sync for org ${job.data.orgId}`);
  
  try {
    const { syncOrgServices } = await import('@/lib/zabbix/sync');
    const result = await syncOrgServices(job.data.orgId);
    
    console.log(`[Worker:Sync] Job ${job.id} completed: synced ${result.syncedCount} services`);
    return { success: true, syncedCount: result.syncedCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Worker:Sync] Job ${job.id} failed:`, message);
    throw error;
  }
}

/**
 * Process maintenance job
 */
async function processMaintenanceJob(job: BullJob<MaintenanceJobData>): Promise<{ success: boolean }> {
  console.log(`[Worker:Maintenance] Processing job ${job.id}: ${job.data.type}`);
  
  try {
    switch (job.data.type) {
      case 'AUDIT_COMPACTION': {
        const { processAuditCompactionJob } = await import('./handlers/audit-compaction');
        const result = await processAuditCompactionJob({
          id: job.id!,
          type: 'AUDIT_COMPACTION',
          data: {
            orgId: job.data.orgId,
            retentionDays: job.data.retentionDays || 90,
          },
          status: 'PROCESSING',
          createdAt: new Date(job.timestamp),
          attempts: job.attemptsMade,
          maxAttempts: 2,
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Audit compaction failed');
        }
        break;
      }
      
      case 'SLA_WARNING_CHECK': {
        const { processSLAWarningCheckJob } = await import('./handlers/sla-warning-check');
        const result = await processSLAWarningCheckJob({
          id: job.id!,
          type: 'SLA_WARNING_CHECK',
          data: { orgId: job.data.orgId },
          status: 'PROCESSING',
          createdAt: new Date(job.timestamp),
          attempts: job.attemptsMade,
          maxAttempts: 2,
        });
        
        if (!result.success) {
          throw new Error(result.error || 'SLA warning check failed');
        }
        break;
      }
      
      case 'RECALCULATE_SLA': {
        const { processRecalculateSLAJob } = await import('./handlers/recalculate-sla');
        const result = await processRecalculateSLAJob({
          id: job.id!,
          type: 'RECALCULATE_SLA',
          data: {
            orgId: job.data.orgId,
            ticketIds: job.data.ticketIds,
          },
          status: 'PROCESSING',
          createdAt: new Date(job.timestamp),
          attempts: job.attemptsMade,
          maxAttempts: 2,
        });
        
        if (!result.success) {
          throw new Error(result.error || 'SLA recalculation failed');
        }
        break;
      }
      
      default:
        throw new Error(`Unknown maintenance job type: ${(job.data as { type: string }).type}`);
    }
    
    console.log(`[Worker:Maintenance] Job ${job.id} completed`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Worker:Maintenance] Job ${job.id} failed:`, message);
    throw error;
  }
}

// Worker event handlers
function attachWorkerEvents(worker: Worker, name: string) {
  worker.on('completed', (job) => {
    console.log(`[Worker:${name}] Job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`[Worker:${name}] Job ${job?.id} failed:`, err.message);
  });
  
  worker.on('error', (err) => {
    console.error(`[Worker:${name}] Error:`, err.message);
    workerStatus.set(name, 'error');
  });
  
  worker.on('ready', () => {
    console.log(`[Worker:${name}] Ready`);
    workerStatus.set(name, 'running');
  });
}

/**
 * Start all workers
 */
export function startWorkers(): void {
  const connection = getConnection();
  
  // Email worker - high priority, process 5 concurrently
  emailWorker = new Worker<EmailJobData>(QUEUE_NAMES.EMAIL, processEmailJob, {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // 10 emails per second max
    },
  });
  attachWorkerEvents(emailWorker, 'Email');
  
  // Export worker - CPU intensive, process 2 concurrently
  exportWorker = new Worker<ExportJobData>(QUEUE_NAMES.EXPORT, processExportJob, {
    connection,
    concurrency: 2,
  });
  attachWorkerEvents(exportWorker, 'Export');
  
  // Sync worker - external API calls, process 3 concurrently
  syncWorker = new Worker<ZabbixSyncJobData>(QUEUE_NAMES.SYNC, processSyncJob, {
    connection,
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 1000, // 5 syncs per second max
    },
  });
  attachWorkerEvents(syncWorker, 'Sync');
  
  // Maintenance worker - background tasks, process 1 at a time
  maintenanceWorker = new Worker<MaintenanceJobData>(QUEUE_NAMES.MAINTENANCE, processMaintenanceJob, {
    connection,
    concurrency: 1,
  });
  attachWorkerEvents(maintenanceWorker, 'Maintenance');
  
  console.log('[Workers] All workers started');
}

/**
 * Stop all workers gracefully
 */
export async function stopWorkers(): Promise<void> {
  console.log('[Workers] Stopping all workers...');
  
  await Promise.all([
    emailWorker?.close(),
    exportWorker?.close(),
    syncWorker?.close(),
    maintenanceWorker?.close(),
  ]);
  
  workerStatus.clear();
  console.log('[Workers] All workers stopped');
}

/**
 * Get worker status for health checks
 */
export function getWorkerStatus(): Record<string, 'running' | 'stopped' | 'error'> {
  return Object.fromEntries(workerStatus);
}

/**
 * Check if all workers are running
 */
export function areWorkersRunning(): boolean {
  return workerStatus.size === 4 && 
    Array.from(workerStatus.values()).every(s => s === 'running');
}
