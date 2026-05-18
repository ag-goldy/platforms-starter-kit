import Link from 'next/link';
import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, organizations, platformAdmins, users } from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/admin/platform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; actor?: string; action?: string; dateFrom?: string; dateTo?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;

  const filters = [];
  if (params.orgId) filters.push(eq(auditLogs.orgId, params.orgId));
  if (params.action) filters.push(eq(auditLogs.action, params.action as typeof auditLogs.action.enumValues[number]));
  if (params.dateFrom) filters.push(gte(auditLogs.createdAt, new Date(params.dateFrom)));
  if (params.dateTo) filters.push(lte(auditLogs.createdAt, new Date(params.dateTo)));
  if (params.actor) {
    filters.push(
      or(
        ilike(users.email, `%${params.actor}%`),
        ilike(platformAdmins.email, `%${params.actor}%`)
      )
    );
  }

  const [tenants, logs] = await Promise.all([
    db.query.organizations.findMany({
      orderBy: (table, { asc }) => [asc(table.name)],
      columns: { id: true, name: true },
      limit: 200,
    }),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        orgId: auditLogs.orgId,
        orgName: organizations.name,
        userEmail: users.email,
        platformAdminEmail: platformAdmins.email,
      })
      .from(auditLogs)
      .leftJoin(organizations, eq(organizations.id, auditLogs.orgId))
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .leftJoin(platformAdmins, eq(platformAdmins.id, auditLogs.platformAdminId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(100),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Cross-Tenant Audit</h1>
        <p className="text-sm text-zinc-400">Search platform and tenant activity across all organizations.</p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-6">
            <select name="orgId" defaultValue={params.orgId || ''} className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              <option value="">All tenants</option>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </select>
            <input name="actor" defaultValue={params.actor || ''} placeholder="Actor email" className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <input name="action" defaultValue={params.action || ''} placeholder="Action" className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <input name="dateFrom" type="date" defaultValue={params.dateFrom || ''} className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <input name="dateTo" type="date" defaultValue={params.dateTo || ''} className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
            <Button type="submit" className="bg-orange-500 text-zinc-950 hover:bg-orange-400">Search</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader><CardTitle>Audit Events</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="py-2">Time</th>
                <th>Tenant</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-3 text-zinc-500">{log.createdAt.toLocaleString()}</td>
                  <td>
                    {log.orgId ? (
                      <Link href={`/admin/tenants/${log.orgId}`} className="hover:text-orange-300">
                        {log.orgName || log.orgId}
                      </Link>
                    ) : 'Platform'}
                  </td>
                  <td className="text-zinc-400">{log.platformAdminEmail || log.userEmail || 'system'}</td>
                  <td>{log.action}</td>
                  <td className="max-w-xl truncate text-zinc-500">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
