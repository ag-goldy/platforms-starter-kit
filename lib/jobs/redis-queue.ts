/**
 * BullMQ Redis Queue Implementation
 * 
 * Replaces the custom Redis list-based queue with BullMQ for:
 * - Better reliability and retry handling
 * - Job scheduling and delayed execution
 * - Queue monitoring and management
 * - Concurrency control
 * 
 * Environment variable JOB_QUEUE_BACKEND controls which implementation to use:
 * - 'redis' (default): Use BullMQ with Redis
 * - 'postgres': Use legacy PostgreSQL queue
 */

import { Queue, Job as BullJob } from 'bullmq';
import { redisConfig } from '@/lib/redis/client';

// Redis connection configuration for BullMQ
const getConnection = () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  // Parse Redis URL for BullMQ
  // Format: redis://username:password@host:port or rediss://...
  const url = new URL(redisUrl);
  
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    // BullMQ specific options
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  };
};

// Queue names
export const QUEUE_NAMES = {
  EMAIL: 'email',
  EXPORT: 'export',
  SYNC: 'zabbix-sync',
  MAINTENANCE: 'maintenance',
} as const;

// Job type definitions
export interface EmailJobData {
  type: 'SEND_EMAIL';
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

export interface ExportJobData {
  type: 'GENERATE_EXPORT' | 'GENERATE_ORG_EXPORT';
  orgId: string;
  exportType: 'tickets' | 'assets' | 'audit' | 'users';
  format: 'csv' | 'xlsx' | 'json';
  userId: string;
  filters?: Record<string, unknown>;
}

export interface ZabbixSyncJobData {
  type: 'ZABBIX_SYNC';
  orgId: string;
  hostId?: string;
}

export interface MaintenanceJobData {
  type: 'AUDIT_COMPACTION' | 'SLA_WARNING_CHECK' | 'RECALCULATE_SLA';
  orgId?: string;
  retentionDays?: number;
  ticketIds?: string[];
}

export type JobData = EmailJobData | ExportJobData | ZabbixSyncJobData | MaintenanceJobData;

// Queue instances (singletons)
let emailQueueInstance: Queue<EmailJobData> | null = null;
let exportQueueInstance: Queue<ExportJobData> | null = null;
let syncQueueInstance: Queue<ZabbixSyncJobData> | null = null;
let maintenanceQueueInstance: Queue<MaintenanceJobData> | null = null;

/**
 * Get email queue instance
 */
export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueueInstance) {
    emailQueueInstance = new Queue<EmailJobData>(QUEUE_NAMES.EMAIL, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return emailQueueInstance;
}

/**
 * Get export queue instance
 */
export function getExportQueue(): Queue<ExportJobData> {
  if (!exportQueueInstance) {
    exportQueueInstance = new Queue<ExportJobData>(QUEUE_NAMES.EXPORT, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 10000,
        },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    });
  }
  return exportQueueInstance;
}

/**
 * Get Zabbix sync queue instance
 */
export function getSyncQueue(): Queue<ZabbixSyncJobData> {
  if (!syncQueueInstance) {
    syncQueueInstance = new Queue<ZabbixSyncJobData>(QUEUE_NAMES.SYNC, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000, // 30s initial delay
        },
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 10 },
      },
    });
  }
  return syncQueueInstance;
}

/**
 * Get maintenance queue instance
 */
export function getMaintenanceQueue(): Queue<MaintenanceJobData> {
  if (!maintenanceQueueInstance) {
    maintenanceQueueInstance = new Queue<MaintenanceJobData>(QUEUE_NAMES.MAINTENANCE, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 60000, // 1 minute
        },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 5 },
      },
    });
  }
  return maintenanceQueueInstance;
}

// Helper type for job enqueue results
type EnqueueResult = { success: true; jobId: string } | { success: false; error: string };

/**
 * Enqueue an email job
 */
export async function enqueueEmail(data: Omit<EmailJobData, 'type'>): Promise<EnqueueResult> {
  try {
    const queue = getEmailQueue();
    const job = await queue.add('send-email', { type: 'SEND_EMAIL', ...data });
    return { success: true, jobId: job.id! };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Queue] Failed to enqueue email:', message);
    return { success: false, error: message };
  }
}

/**
 * Enqueue an export job
 */
export async function enqueueExport(
  data: Omit<ExportJobData, 'type'>,
  isOrgExport: boolean = false
): Promise<EnqueueResult> {
  try {
    const queue = getExportQueue();
    const type = isOrgExport ? 'GENERATE_ORG_EXPORT' : 'GENERATE_EXPORT';
    const job = await queue.add('generate-export', { type, ...data } as ExportJobData);
    return { success: true, jobId: job.id! };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Queue] Failed to enqueue export:', message);
    return { success: false, error: message };
  }
}

/**
 * Enqueue a Zabbix sync job
 */
export async function enqueueZabbixSync(data: Omit<ZabbixSyncJobData, 'type'>): Promise<EnqueueResult> {
  try {
    const queue = getSyncQueue();
    const job = await queue.add('zabbix-sync', { type: 'ZABBIX_SYNC', ...data });
    return { success: true, jobId: job.id! };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Queue] Failed to enqueue Zabbix sync:', message);
    return { success: false, error: message };
  }
}

/**
 * Enqueue a maintenance job
 */
export async function enqueueMaintenance(data: MaintenanceJobData): Promise<EnqueueResult> {
  try {
    const queue = getMaintenanceQueue();
    const jobName = data.type.toLowerCase().replace(/_/g, '-');
    const job = await queue.add(jobName, data);
    return { success: true, jobId: job.id! };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Queue] Failed to enqueue maintenance:', message);
    return { success: false, error: message };
  }
}

/**
 * Get queue statistics for monitoring
 */
export async function getQueueStats(): Promise<{
  email: { waiting: number; active: number; completed: number; failed: number };
  export: { waiting: number; active: number; completed: number; failed: number };
  sync: { waiting: number; active: number; completed: number; failed: number };
  maintenance: { waiting: number; active: number; completed: number; failed: number };
}> {
  const [email, exportQ, sync, maintenance] = await Promise.all([
    getEmailQueue().getJobCounts(),
    getExportQueue().getJobCounts(),
    getSyncQueue().getJobCounts(),
    getMaintenanceQueue().getJobCounts(),
  ]);

  return {
    email,
    export: exportQ,
    sync,
    maintenance,
  };
}

/**
 * Clean up old jobs from all queues
 */
export async function cleanOldJobs(olderThanHours: number = 24): Promise<void> {
  const grace = olderThanHours * 60 * 60 * 1000;
  
  await Promise.all([
    getEmailQueue().clean(grace, 100, 'completed'),
    getEmailQueue().clean(grace, 100, 'failed'),
    getExportQueue().clean(grace, 100, 'completed'),
    getExportQueue().clean(grace, 100, 'failed'),
    getSyncQueue().clean(grace, 100, 'completed'),
    getSyncQueue().clean(grace, 100, 'failed'),
    getMaintenanceQueue().clean(grace, 100, 'completed'),
    getMaintenanceQueue().clean(grace, 100, 'failed'),
  ]);
}

// Close all queue connections (for graceful shutdown)
export async function closeQueues(): Promise<void> {
  await Promise.all([
    emailQueueInstance?.close(),
    exportQueueInstance?.close(),
    syncQueueInstance?.close(),
    maintenanceQueueInstance?.close(),
  ]);
}
