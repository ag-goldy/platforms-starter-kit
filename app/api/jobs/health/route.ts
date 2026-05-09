import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats, getWorkerStatus } from '@/lib/jobs';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [stats, workerMap] = await Promise.all([
      getQueueStats(),
      Promise.resolve(getWorkerStatus()),
    ]);

    const workers = Object.fromEntries(workerMap);
    const allRunning = Object.values(workers).every((s) => s === 'running');

    const totalFailed = Object.values(stats).reduce((sum, q) => sum + (q.failed ?? 0), 0);
    const healthy = allRunning && totalFailed === 0;

    return NextResponse.json(
      { healthy, queues: stats, workers },
      { status: healthy ? 200 : 503 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ healthy: false, error: message }, { status: 503 });
  }
}