/**
 * Queue metrics and operations — thin wrapper over redis-queue
 *
 * This file exists for backward compatibility with importers.
 * New code should import directly from `@/lib/jobs` or `@/lib/jobs/redis-queue`.
 */

export { enqueueJob } from "./index";

import type { JobType } from "./types";
import {
  getEmailQueue,
  getExportQueue,
  getSyncQueue,
  getMaintenanceQueue,
} from "./redis-queue";

function getQueueByType(type: JobType | "ZABBIX_SYNC") {
  if (type === "SEND_EMAIL") return getEmailQueue();
  if (type === "GENERATE_EXPORT" || type === "GENERATE_ORG_EXPORT")
    return getExportQueue();
  if (type === "ZABBIX_SYNC") return getSyncQueue();
  return getMaintenanceQueue();
}

export async function getQueueDepth(
  type: JobType | "ZABBIX_SYNC",
): Promise<number> {
  const counts = await getQueueByType(type).getJobCounts(
    "waiting",
    "delayed",
    "paused",
  );
  return (counts.waiting || 0) + (counts.delayed || 0) + (counts.paused || 0);
}

export async function getProcessingCount(
  type: JobType | "ZABBIX_SYNC",
): Promise<number> {
  const counts = await getQueueByType(type).getJobCounts("active");
  return counts.active || 0;
}

export async function getFailedCount(
  type: JobType | "ZABBIX_SYNC",
): Promise<number> {
  const counts = await getQueueByType(type).getJobCounts("failed");
  return counts.failed || 0;
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
      type: (job.data as { type?: string }).type || "unknown",
      status: state,
      data: job.data,
      createdAt: job.timestamp ? new Date(job.timestamp) : null,
    };
  }

  return null;
}
