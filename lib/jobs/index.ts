/**
 * Unified Job Queue Interface
 * 
 * Automatically selects backend based on JOB_QUEUE_BACKEND env var:
 * - 'bullmq' (default): Use BullMQ with Redis (recommended)
 * - 'legacy': Use legacy custom Redis list implementation
 * 
 * This module provides a consistent API regardless of backend.
 */

import type { Job, JobType } from './types';

// Backend selection
const BACKEND = process.env.JOB_QUEUE_BACKEND || 'bullmq';
const useBullMQ = BACKEND === 'bullmq';

console.log(`[Jobs] Using ${useBullMQ ? 'BullMQ' : 'Legacy'} job queue backend`);

// Export types
export type { Job, JobType } from './types';

// Import and re-export based on backend
if (useBullMQ) {
  // BullMQ exports
  export {
    getEmailQueue,
    getExportQueue,
    getSyncQueue,
    getMaintenanceQueue,
    enqueueEmail,
    enqueueExport,
    enqueueZabbixSync,
    enqueueMaintenance,
    getQueueStats as getBullQueueStats,
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
} else {
  // Legacy exports (placeholders - actual legacy functions remain in queue.ts)
  console.warn('[Jobs] Legacy queue backend is deprecated. Please migrate to BullMQ.');
}

// Unified enqueue function that works with both backends
interface EnqueueOptions {
  type: JobType;
  data: unknown;
  maxAttempts?: number;
  delay?: number; // Delay in milliseconds (BullMQ only)
}

/**
 * Unified job enqueue function
 * Automatically selects appropriate queue based on job type
 */
export async function enqueueJob(options: EnqueueOptions): Promise<{ success: boolean; jobId?: string; error?: string }> {
  if (useBullMQ) {
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
        return enqueueMaintenance({
          type: options.type,
          ...options.data as object,
        });
        
      default:
        return { success: false, error: `Unknown job type: ${options.type}` };
    }
  } else {
    // Legacy backend
    const { enqueueJob: legacyEnqueue } = await import('./queue');
    const jobId = await legacyEnqueue({
      type: options.type,
      data: options.data,
      maxAttempts: options.maxAttempts,
    } as Omit<Job, 'id' | 'status' | 'createdAt' | 'attempts'>);
    return { success: true, jobId };
  }
}

/**
 * Get unified queue statistics
 */
export async function getQueueStats(): Promise<{
  email: { waiting: number; active: number; completed: number; failed: number };
  export: { waiting: number; active: number; completed: number; failed: number };
  sync: { waiting: number; active: number; completed: number; failed: number };
  maintenance: { waiting: number; active: number; completed: number; failed: number };
}> {
  if (useBullMQ) {
    const { getQueueStats: bullStats } = await import('./redis-queue');
    return bullStats();
  } else {
    // Legacy stats
    const { getQueueDepth, getProcessingCount, getFailedCount } = await import('./queue');
    const types: JobType[] = ['SEND_EMAIL', 'GENERATE_EXPORT', 'GENERATE_ORG_EXPORT', 'AUDIT_COMPACTION', 'SLA_WARNING_CHECK'];
    
    // Map legacy types to new categories
    const stats = {
      email: { waiting: 0, active: 0, completed: 0, failed: 0 },
      export: { waiting: 0, active: 0, completed: 0, failed: 0 },
      sync: { waiting: 0, active: 0, completed: 0, failed: 0 },
      maintenance: { waiting: 0, active: 0, completed: 0, failed: 0 },
    };
    
    for (const type of types) {
      const waiting = await getQueueDepth(type);
      const active = await getProcessingCount(type);
      const failed = await getFailedCount(type);
      
      if (type === 'SEND_EMAIL') {
        stats.email = { waiting, active, completed: 0, failed };
      } else if (type === 'GENERATE_EXPORT' || type === 'GENERATE_ORG_EXPORT') {
        stats.export.waiting += waiting;
        stats.export.active += active;
        stats.export.failed += failed;
      } else {
        stats.maintenance.waiting += waiting;
        stats.maintenance.active += active;
        stats.maintenance.failed += failed;
      }
    }
    
    return stats;
  }
}

/**
 * Initialize workers (call this in your application startup)
 * Only needed for BullMQ backend
 */
export function initializeWorkers(): void {
  if (useBullMQ) {
    import('./redis-worker').then(({ startWorkers }) => {
      startWorkers();
    });
  }
}

/**
 * Graceful shutdown (call this when application is shutting down)
 */
export async function shutdownWorkers(): Promise<void> {
  if (useBullMQ) {
    const { stopWorkers } = await import('./redis-worker');
    const { closeQueues } = await import('./redis-queue');
    await stopWorkers();
    await closeQueues();
  }
}
