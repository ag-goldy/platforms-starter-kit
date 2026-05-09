import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/jobs', () => ({
  getQueueStats: vi.fn().mockResolvedValue({
    email: { waiting: 0, active: 1, completed: 42, failed: 0 },
    export: { waiting: 2, active: 0, completed: 10, failed: 0 },
    sync: { waiting: 0, active: 0, completed: 5, failed: 0 },
    maintenance: { waiting: 0, active: 0, completed: 3, failed: 0 },
  }),
  getWorkerStatus: vi.fn().mockReturnValue(
    new Map([
      ['email', 'running'],
      ['export', 'running'],
      ['zabbix-sync', 'running'],
      ['maintenance', 'running'],
    ])
  ),
}));

vi.mock('@/lib/api/verify-cron', () => ({
  verifyCronRequest: vi.fn().mockResolvedValue({ valid: true }),
}));

describe('GET /api/jobs/health', () => {
  it('returns 200 with queue stats when all workers running', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const { GET } = await import('@/app/api/jobs/health/route');
    const req = new Request('http://localhost/api/jobs/health', {
      headers: { authorization: `Bearer test-secret` },
    });

    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.healthy).toBe(true);
    expect(body.queues.email.active).toBe(1);
    expect(body.workers.email).toBe('running');
  });
});
