import Link from 'next/link';
import { desc, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, failedJobs, organizations, tickets } from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/admin/platform';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createTenantAction, enableTenantAction, scheduleTenantDeleteAction, suspendTenantAction } from './actions';

function tenantStatus(org: typeof organizations.$inferSelect) {
  if (org.deletedAt) return <Badge variant="destructive">Deleted</Badge>;
  if (org.deletionScheduledAt) return <Badge variant="outline">Delete scheduled</Badge>;
  if (!org.isActive) return <Badge variant="secondary">Suspended</Badge>;
  return <Badge>Active</Badge>;
}

export default async function PlatformAdminHome() {
  await requirePlatformAdmin();

  const [tenants, totalTickets, failedJobRows, recentAudit] = await Promise.all([
    db.query.organizations.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit: 100,
    }),
    db.select({ count: sql<number>`count(*)` }).from(tickets).where(isNull(tickets.deletedAt)),
    db.select({ count: sql<number>`count(*)` }).from(failedJobs),
    db.query.auditLogs.findMany({
      orderBy: [desc(auditLogs.createdAt)],
      limit: 6,
      with: { organization: true },
    }),
  ]);

  const activeTenants = tenants.filter((tenant) => tenant.isActive && !tenant.deletedAt).length;
  const suspendedTenants = tenants.filter((tenant) => !tenant.isActive && !tenant.deletedAt).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Platform Admin</h1>
          <p className="text-sm text-zinc-400">
            Manage tenants, platform health, jobs, feature flags, and cross-tenant audit.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800">
            <Link href="/admin/audit">Search Audit</Link>
          </Button>
          <Button asChild className="bg-orange-500 text-zinc-950 hover:bg-orange-400">
            <Link href="/admin/health">System Health</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader><CardTitle className="text-sm text-zinc-400">Tenants</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{tenants.length}</CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader><CardTitle className="text-sm text-zinc-400">Active</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{activeTenants}</CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader><CardTitle className="text-sm text-zinc-400">Suspended</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{suspendedTenants}</CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader><CardTitle className="text-sm text-zinc-400">Tickets / Failed Jobs</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">
            {Number(totalTickets[0]?.count || 0)} / {Number(failedJobRows[0]?.count || 0)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader><CardTitle>Tenants</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2">Tenant</th>
                  <th>Status</th>
                  <th>Domain</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="py-3">
                      <Link href={`/admin/tenants/${tenant.id}`} className="font-medium text-white hover:text-orange-300">
                        {tenant.name}
                      </Link>
                      <div className="text-xs text-zinc-500">{tenant.slug}</div>
                    </td>
                    <td>{tenantStatus(tenant)}</td>
                    <td className="text-zinc-400">{tenant.subdomain}</td>
                    <td className="text-zinc-500">{tenant.createdAt.toLocaleDateString()}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        {tenant.isActive ? (
                          <form action={suspendTenantAction}>
                            <input type="hidden" name="orgId" value={tenant.id} />
                            <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-950 text-zinc-200">Suspend</Button>
                          </form>
                        ) : (
                          <form action={enableTenantAction}>
                            <input type="hidden" name="orgId" value={tenant.id} />
                            <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-950 text-zinc-200">Enable</Button>
                          </form>
                        )}
                        <form action={scheduleTenantDeleteAction}>
                          <input type="hidden" name="orgId" value={tenant.id} />
                          <Button size="sm" variant="outline" className="border-rose-900 bg-rose-950 text-rose-200">Schedule delete</Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
            <CardHeader><CardTitle>Create Tenant</CardTitle></CardHeader>
            <CardContent>
              <form action={createTenantAction} className="space-y-3">
                <input name="name" placeholder="Tenant name" className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" required />
                <input name="slug" placeholder="slug" className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" required />
                <input name="ownerEmail" type="email" placeholder="owner@example.com" className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" required />
                <div className="grid grid-cols-2 gap-2">
                  <select name="plan" defaultValue="free" className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <select name="region" defaultValue="us" className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="us">US</option>
                    <option value="sg">Singapore</option>
                    <option value="eu">EU</option>
                  </select>
                </div>
                <input name="retentionDays" type="number" min="30" placeholder="Retention days (optional)" className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                <Button type="submit" className="w-full bg-orange-500 text-zinc-950 hover:bg-orange-400">
                  Create tenant
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
            <CardHeader><CardTitle>Recent Audit</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {recentAudit.map((log) => (
                <div key={log.id} className="border-b border-zinc-800 pb-3 last:border-0">
                  <div className="font-medium">{log.action}</div>
                  <div className="text-xs text-zinc-500">
                    {log.organization?.name || 'Platform'} · {log.createdAt.toLocaleString()}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
