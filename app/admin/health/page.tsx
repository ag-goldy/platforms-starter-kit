import { list } from '@vercel/blob';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { failedJobs, organizations, tickets } from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/admin/platform';
import { isRedisConfigured, redis } from '@/lib/redis/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Status({ ok }: { ok: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ok ? 'bg-emerald-400 text-zinc-950' : 'bg-rose-500 text-white'}`}>
      {ok ? 'OK' : 'FAIL'}
    </span>
  );
}

export default async function PlatformHealthPage() {
  await requirePlatformAdmin();

  let dbStatus = { ok: false, message: 'Unavailable', latency: 0 };
  try {
    const startedAt = Date.now();
    await db.execute(sql`select 1`);
    dbStatus = { ok: true, message: 'Connected', latency: Date.now() - startedAt };
  } catch (error) {
    dbStatus = { ok: false, message: error instanceof Error ? error.message : 'Database failed', latency: 0 };
  }

  let redisStatus = { ok: false, message: 'Not configured' };
  if (isRedisConfigured) {
    try {
      const key = `platform-health:${Date.now()}`;
      await redis.set(key, '1', { ex: 30 });
      redisStatus = { ok: (await redis.get(key)) === '1', message: 'Connected' };
    } catch (error) {
      redisStatus = { ok: false, message: error instanceof Error ? error.message : 'Redis failed' };
    }
  }

  let blobStatus = { ok: false, message: 'Not configured' };
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await list({ limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
      blobStatus = { ok: true, message: 'Connected' };
    } catch (error) {
      blobStatus = { ok: false, message: error instanceof Error ? error.message : 'Blob failed' };
    }
  }

  const [tenantCount, ticketCount, failedJobCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(organizations),
    db.select({ count: sql<number>`count(*)` }).from(tickets),
    db.select({ count: sql<number>`count(*)` }).from(failedJobs),
  ]);

  const checks = [
    { name: 'Database', ...dbStatus },
    { name: 'Redis', ...redisStatus },
    { name: 'Blob Storage', ...blobStatus },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">System Health</h1>
        <p className="text-sm text-zinc-400">Platform-level service checks and operational counters.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {checks.map((check) => (
          <Card key={check.name} className="border-zinc-800 bg-zinc-900 text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{check.name}</CardTitle>
              <Status ok={check.ok} />
            </CardHeader>
            <CardContent className="text-sm text-zinc-400">
              {check.message}{'latency' in check && check.latency ? ` · ${check.latency}ms` : ''}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader><CardTitle className="text-sm text-zinc-400">Tenants</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{Number(tenantCount[0]?.count || 0)}</CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader><CardTitle className="text-sm text-zinc-400">Tickets</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{Number(ticketCount[0]?.count || 0)}</CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader><CardTitle className="text-sm text-zinc-400">Failed Jobs</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{Number(failedJobCount[0]?.count || 0)}</CardContent>
        </Card>
      </div>
    </div>
  );
}
