import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { failedJobs } from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/admin/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { discardAdminFailedJobAction, retryAdminFailedJobAction } from '../actions';

export default async function PlatformFailedJobsPage() {
  await requirePlatformAdmin();
  const jobs = await db.query.failedJobs.findMany({
    orderBy: [desc(failedJobs.failedAt)],
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Failed Jobs</h1>
        <p className="text-sm text-zinc-400">Retry or discard dead-letter jobs.</p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader><CardTitle>Dead Letter Queue</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {jobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">No failed jobs.</div>
          ) : jobs.map((job) => (
            <div key={job.id} className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{job.type}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {job.jobId} · attempts {job.attempts}/{job.maxAttempts} · failed {job.failedAt.toLocaleString()}
                  </div>
                  <pre className="mt-3 max-h-28 overflow-auto rounded bg-rose-950/50 p-3 text-xs text-rose-100">{job.error}</pre>
                  <details className="mt-2 text-xs text-zinc-500">
                    <summary className="cursor-pointer">Payload</summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-900 p-3">{JSON.stringify(job.data, null, 2)}</pre>
                  </details>
                </div>
                <div className="flex gap-2">
                  <form action={retryAdminFailedJobAction}>
                    <input type="hidden" name="id" value={job.id} />
                    <Button type="submit" size="sm" className="bg-orange-500 text-zinc-950 hover:bg-orange-400">Retry</Button>
                  </form>
                  <form action={discardAdminFailedJobAction}>
                    <input type="hidden" name="id" value={job.id} />
                    <Button type="submit" size="sm" variant="outline" className="border-zinc-700 bg-zinc-950 text-zinc-100">Discard</Button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
