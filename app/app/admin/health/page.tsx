import { requireInternalAdmin } from '@/lib/auth/permissions';
import { db } from '@/db';
import { emailOutbox } from '@/db/schema';
import { listFailedOutbox } from '@/lib/email/outbox';
import { isSmtpConfigured } from '@/lib/email/smtp';
import { isRedisConfigured, redis } from '@/lib/redis';
import { sql, eq } from 'drizzle-orm';
import { list } from '@vercel/blob';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { retryEmailAction, sendHealthCheckEmailAction } from './actions';
import { getQueueDepth, getProcessingCount, getFailedCount } from '@/lib/jobs/queue';

function statusBadge(ok: boolean) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }`}
    >
      {ok ? 'OK' : 'FAIL'}
    </span>
  );
}

export default async function HealthPage() {
  await requireInternalAdmin();

  let dbStatus = { ok: false, message: 'Unavailable', latency: 0 };
  try {
    const startTime = Date.now();
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database timeout')), 5000)
      ),
    ]);
    const latency = Date.now() - startTime;
    dbStatus = { ok: true, message: 'Connected', latency };
  } catch (error) {
    dbStatus = {
      ok: false,
      message: (error as Error).message,
      latency: 0,
    };
  }

  let blobStatus = { ok: false, message: 'Not configured' };
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      await list({ limit: 1, token: blobToken });
      blobStatus = { ok: true, message: 'Connected' };
    } catch (error) {
      blobStatus = { ok: false, message: (error as Error).message };
    }
  }

  const smtpStatus = {
    ok: isSmtpConfigured(),
    message: isSmtpConfigured() ? 'Configured' : 'Missing config',
  };

  let redisStatus = { ok: false, message: 'Not configured' };
  if (isRedisConfigured) {
    try {
      const key = `health:${Date.now()}`;
      await redis.set(key, '1');
      await redis.expire(key, 30);
      const value = await redis.get<string>(key);
      redisStatus = {
        ok: value === '1',
        message: value === '1' ? 'Connected' : 'No response',
      };
    } catch (error) {
      redisStatus = { ok: false, message: (error as Error).message };
    }
  }

  const failedEmailRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailOutbox)
    .where(eq(emailOutbox.status, 'FAILED'));
  const failedEmailCount = Number(failedEmailRows[0]?.count ?? 0);

  const failedEmails = await listFailedOutbox(10);

  let tokenFailures = 0;
  try {
    const keys = await redis.keys('security:token_fail:*');
    if (keys.length > 0) {
      const values = await redis.mget<number>(...keys);
      tokenFailures = values.reduce((sum: number, value) => sum + (value ?? 0), 0);
    }
  } catch (error) {
    console.warn('[Health] Failed to read token failure metrics', error);
  }

  // Job queue depths
  let jobQueueStats = {
    SEND_EMAIL: { queue: 0, processing: 0, failed: 0 },
    GENERATE_EXPORT: { queue: 0, processing: 0, failed: 0 },
    GENERATE_ORG_EXPORT: { queue: 0, processing: 0, failed: 0 },
    RECALCULATE_SLA: { queue: 0, processing: 0, failed: 0 },
    PROCESS_ATTACHMENT: { queue: 0, processing: 0, failed: 0 },
    AUDIT_COMPACTION: { queue: 0, processing: 0, failed: 0 },
  };

  try {
    jobQueueStats = {
      SEND_EMAIL: {
        queue: await getQueueDepth('SEND_EMAIL'),
        processing: await getProcessingCount('SEND_EMAIL'),
        failed: await getFailedCount('SEND_EMAIL'),
      },
      GENERATE_EXPORT: {
        queue: await getQueueDepth('GENERATE_EXPORT'),
        processing: await getProcessingCount('GENERATE_EXPORT'),
        failed: await getFailedCount('GENERATE_EXPORT'),
      },
      GENERATE_ORG_EXPORT: {
        queue: await getQueueDepth('GENERATE_ORG_EXPORT'),
        processing: await getProcessingCount('GENERATE_ORG_EXPORT'),
        failed: await getFailedCount('GENERATE_ORG_EXPORT'),
      },
      RECALCULATE_SLA: {
        queue: await getQueueDepth('RECALCULATE_SLA'),
        processing: await getProcessingCount('RECALCULATE_SLA'),
        failed: await getFailedCount('RECALCULATE_SLA'),
      },
      PROCESS_ATTACHMENT: {
        queue: await getQueueDepth('PROCESS_ATTACHMENT'),
        processing: await getProcessingCount('PROCESS_ATTACHMENT'),
        failed: await getFailedCount('PROCESS_ATTACHMENT'),
      },
      AUDIT_COMPACTION: {
        queue: await getQueueDepth('AUDIT_COMPACTION'),
        processing: await getProcessingCount('AUDIT_COMPACTION'),
        failed: await getFailedCount('AUDIT_COMPACTION'),
      },
    };
  } catch (error) {
    console.warn('[Health] Failed to read job queue stats', error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="text-sm text-gray-600">
          Live checks for critical infrastructure and recent failures.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Database</CardTitle>
            {statusBadge(dbStatus.ok)}
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            {dbStatus.message}
            {dbStatus.latency > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                ({dbStatus.latency}ms)
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Blob Storage</CardTitle>
            {statusBadge(blobStatus.ok)}
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            {blobStatus.message}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">SMTP</CardTitle>
            {statusBadge(smtpStatus.ok)}
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            {smtpStatus.message}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Rate Limit Store</CardTitle>
            {statusBadge(redisStatus.ok)}
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            {redisStatus.message}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Failures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>Failed emails</span>
              <span className="font-medium text-gray-900">{failedEmailCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Token validation errors (48h)</span>
              <span className="font-medium text-gray-900">{tokenFailures}</span>
            </div>
            <form action={sendHealthCheckEmailAction}>
              <Button type="submit" size="sm" variant="outline">
                Send test email
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Job Queue Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span>Email Jobs</span>
                <span>
                  Q:{jobQueueStats.SEND_EMAIL.queue} P:{jobQueueStats.SEND_EMAIL.processing} F:{jobQueueStats.SEND_EMAIL.failed}
                </span>
              </div>
              <div className="flex items-center justify-between font-medium">
                <span>Export Jobs</span>
                <span>
                  Q:{jobQueueStats.GENERATE_EXPORT.queue} P:{jobQueueStats.GENERATE_EXPORT.processing} F:{jobQueueStats.GENERATE_EXPORT.failed}
                </span>
              </div>
              <div className="flex items-center justify-between font-medium">
                <span>Org Export Jobs</span>
                <span>
                  Q:{jobQueueStats.GENERATE_ORG_EXPORT.queue} P:{jobQueueStats.GENERATE_ORG_EXPORT.processing} F:{jobQueueStats.GENERATE_ORG_EXPORT.failed}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Q = Queue, P = Processing, F = Failed</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Failed Email Outbox</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            {failedEmails.length === 0 && (
              <p className="text-sm text-gray-500">No failed emails.</p>
            )}
            {failedEmails.map((email) => (
              <div
                key={email.id}
                className="rounded-md border border-gray-200 bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {email.subject}
                    </p>
                    <p className="text-xs text-gray-500">To: {email.to}</p>
                  </div>
                  <form action={retryEmailAction}>
                    <input type="hidden" name="id" value={email.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Retry
                    </Button>
                  </form>
                </div>
                {email.lastError && (
                  <p className="mt-2 text-xs text-rose-700">
                    {email.lastError}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
