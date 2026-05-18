import type { JobType } from './types';
import type { Queue } from 'bullmq';
import {
  getEmailQueue,
  getExportQueue,
  getMaintenanceQueue,
  getSyncQueue,
} from './redis-queue';

type QueueName = 'email' | 'export' | 'sync' | 'maintenance';

type EnqueueOptions = {
  type: JobType | 'ZABBIX_SYNC';
  data: unknown;
  maxAttempts?: number;
  delay?: number;
};

function queueNameForType(type: string): QueueName {
  if (type === 'SEND_EMAIL') return 'email';
  if (type === 'GENERATE_EXPORT' || type === 'GENERATE_ORG_EXPORT') return 'export';
  if (type === 'ZABBIX_SYNC') return 'sync';
  return 'maintenance';
}

function getQueueByName(name: QueueName) {
  if (name === 'email') return getEmailQueue();
  if (name === 'export') return getExportQueue();
  if (name === 'sync') return getSyncQueue();
  return getMaintenanceQueue();
}

function getQueueByType(type: string) {
  return getQueueByName(queueNameForType(type));
}

function asGenericQueue(queue: ReturnType<typeof getQueueByType>): Queue<Record<string, unknown>> {
  return queue as unknown as Queue<Record<string, unknown>>;
}

function normalizeStatus(state: string) {
  if (state === 'completed') return 'COMPLETED';
  if (state === 'failed') return 'FAILED';
  if (state === 'active') return 'PROCESSING';
  return 'PENDING';
}

export async function enqueueJob(options: EnqueueOptions): Promise<string> {
  const queue = asGenericQueue(getQueueByType(options.type));
  const jobName = options.type.toLowerCase().replace(/_/g, '-');
  const job = await queue.add(jobName, { type: options.type, ...(options.data as object) }, {
    attempts: options.maxAttempts,
    delay: options.delay,
  });

  return job.id!;
}

export async function getJob(jobId: string) {
  const queues = [
    getEmailQueue(),
    getExportQueue(),
    getSyncQueue(),
    getMaintenanceQueue(),
  ];

  for (const queue of queues) {
    const job = await queue.getJob(jobId);
    if (!job) continue;

    const state = await job.getState();
    return {
      id: job.id,
      type: job.data?.type,
      status: normalizeStatus(state),
      data: job.data,
      result: job.returnvalue,
      error: job.failedReason || null,
      attempts: job.attemptsMade,
      createdAt: new Date(job.timestamp),
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }

  return null;
}

export async function getQueueDepth(type: JobType | 'ZABBIX_SYNC'): Promise<number> {
  const counts = await getQueueByType(type).getJobCounts('waiting', 'delayed', 'paused');
  return (counts.waiting || 0) + (counts.delayed || 0) + (counts.paused || 0);
}

export async function getProcessingCount(type: JobType | 'ZABBIX_SYNC'): Promise<number> {
  const counts = await getQueueByType(type).getJobCounts('active');
  return counts.active || 0;
}

export async function getFailedCount(type: JobType | 'ZABBIX_SYNC'): Promise<number> {
  const counts = await getQueueByType(type).getJobCounts('failed');
  return counts.failed || 0;
}
