/**
 * Worker orchestration — thin wrapper over redis-worker
 *
 * This file exists for backward compatibility with importers.
 * New code should import directly from `@/lib/jobs` or `@/lib/jobs/redis-worker`.
 */

import type { JobType } from "./types";
import { getQueueDepth } from "./queue";

const PROCESSABLE_JOB_TYPES = [
  "SEND_EMAIL",
  "GENERATE_EXPORT",
  "GENERATE_ORG_EXPORT",
  "RECALCULATE_SLA",
  "PROCESS_ATTACHMENT",
  "AUDIT_COMPACTION",
] as const satisfies readonly JobType[];

type ProcessCounts = Record<(typeof PROCESSABLE_JOB_TYPES)[number], number>;

export async function processAllQueues(
  _maxJobsPerType = 10,
): Promise<ProcessCounts> {
  const { startWorkers, areWorkersRunning } = await import("./redis-worker");

  if (!areWorkersRunning()) {
    startWorkers();
  }

  const entries = await Promise.all(
    PROCESSABLE_JOB_TYPES.map(
      async (type) => [type, await getQueueDepth(type)] as const,
    ),
  );

  return Object.fromEntries(
    entries.map(([type]) => [type, 0]),
  ) as ProcessCounts;
}
