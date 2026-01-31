import { requireInternalAdmin } from '@/lib/auth/permissions';
import { getFailedJobsAction } from '@/app/app/actions/jobs';
import { FailedJobsList } from '@/components/admin/failed-jobs-list';
import type { JobType } from '@/lib/jobs/types';

const jobTypeSet = new Set<JobType>([
  'SEND_EMAIL',
  'GENERATE_EXPORT',
  'GENERATE_ORG_EXPORT',
  'RECALCULATE_SLA',
  'PROCESS_ATTACHMENT',
  'AUDIT_COMPACTION',
]);

export default async function FailedJobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}) {
  await requireInternalAdmin();
  const params = await searchParams;
  
  const page = parseInt(params.page || '1', 10);
  const limit = 50;
  const offset = (page - 1) * limit;
  const jobType =
    params.type && jobTypeSet.has(params.type as JobType)
      ? (params.type as JobType)
      : undefined;
  
  const { jobs, total } = await getFailedJobsAction({
    type: jobType,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    limit,
    offset,
  });
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Failed Jobs</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and manage permanently failed jobs from the queue
        </p>
      </div>
      
      <FailedJobsList
        jobs={jobs}
        total={total}
        currentPage={page}
        limit={limit}
        filters={{
          type: params.type,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        }}
      />
    </div>
  );
}
