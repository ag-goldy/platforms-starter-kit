import Link from 'next/link';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Activity, AlertTriangle, ArrowUpRight, Building2, Clock3, Database, LifeBuoy, ShieldCheck, Ticket } from 'lucide-react';
import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { auditLogs, failedJobs, organizations, services, tickets } from '@/db/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function StatCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  detail: string;
  href: string;
  icon: typeof Ticket;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
          <Icon className="h-4 w-4 text-slate-400 group-hover:text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  await requireInternalRole();

  const [
    ticketCounts,
    publicIntake,
    activeOrgs,
    monitoredServices,
    failedJobRows,
    recentAudit,
    newestTickets,
  ] = await Promise.all([
    db
      .select({ status: tickets.status, count: sql<number>`count(*)` })
      .from(tickets)
      .where(isNull(tickets.deletedAt))
      .groupBy(tickets.status),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(and(isNull(tickets.deletedAt), isNull(tickets.orgId))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(and(eq(organizations.isActive, true), isNull(organizations.deletedAt))),
    db
      .select({ status: services.monitoringStatus, count: sql<number>`count(*)` })
      .from(services)
      .where(eq(services.monitoringEnabled, true))
      .groupBy(services.monitoringStatus),
    db.select({ count: sql<number>`count(*)` }).from(failedJobs),
    db.query.auditLogs.findMany({
      orderBy: [desc(auditLogs.createdAt)],
      limit: 6,
      with: { organization: true },
    }),
    db.query.tickets.findMany({
      where: isNull(tickets.deletedAt),
      orderBy: [desc(tickets.updatedAt)],
      limit: 8,
      with: {
        organization: { columns: { id: true, name: true, customerId: true } },
        assignee: { columns: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const countFor = (statuses: string[]) =>
    ticketCounts
      .filter((row) => statuses.includes(row.status))
      .reduce((total, row) => total + Number(row.count || 0), 0);

  const activeQueue = countFor(['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER']);
  const slaRisk = countFor(['NEW', 'OPEN', 'IN_PROGRESS']);
  const resolvedToday = countFor(['RESOLVED']);
  const publicIntakeCount = Number(publicIntake[0]?.count || 0);
  const failedJobsCount = Number(failedJobRows[0]?.count || 0);
  const monitoredTotal = monitoredServices.reduce((total, row) => total + Number(row.count || 0), 0);
  const unhealthyServices = monitoredServices
    .filter((row) => row.status && !['OPERATIONAL', 'OK', 'ACTIVE'].includes(row.status))
    .reduce((total, row) => total + Number(row.count || 0), 0);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-orange-600">
            <Activity className="h-4 w-4" />
            Command Center
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Enterprise service desk overview</h1>
          <p className="mt-2 text-sm text-slate-500">
            Live operational view across ticket lifecycle, public intake, SLA pressure, monitored services, background jobs, audit, and tenant activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/app/tickets/new">Create ticket</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/admin/audit">Audit search</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active queue" value={activeQueue} detail="New, open, in progress, waiting" href="/app/tickets" icon={Ticket} />
        <StatCard label="Public intake" value={publicIntakeCount} detail="Requests without an organization" href="/app/tickets?orgId=public" icon={LifeBuoy} />
        <StatCard label="SLA risk" value={slaRisk} detail={`${resolvedToday} currently resolved`} href="/app/sla" icon={Clock3} />
        <StatCard label="Failed jobs" value={failedJobsCount} detail="Background work requiring review" href="/app/admin/jobs" icon={AlertTriangle} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Service desk activity</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Newest ticket movement with ownership and customer context.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/tickets">
                Open queue
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2 pr-4">Ticket</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Owner</th>
                  <th className="py-2 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {newestTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="max-w-[340px] py-3 pr-4">
                      <Link href={`/app/tickets/${ticket.id}`} className="font-medium hover:text-orange-600">
                        {ticket.subject}
                      </Link>
                      <div className="font-mono text-xs text-slate-500">{ticket.key}</div>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      {ticket.organization?.customerId || ticket.organization?.name || 'Public intake'}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{ticket.status}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      {ticket.assignee?.name || ticket.assignee?.email || 'Unassigned'}
                    </td>
                    <td className="py-3 text-right text-xs text-slate-500">
                      {ticket.updatedAt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-base">Platform health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-400" /> Active tenants</span>
                <span className="font-semibold">{Number(activeOrgs[0]?.count || 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <span className="flex items-center gap-2"><Database className="h-4 w-4 text-slate-400" /> Monitored services</span>
                <span className="font-semibold">{monitoredTotal}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-slate-400" /> Service warnings</span>
                <span className="font-semibold">{unhealthyServices}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent audit</CardTitle>
              <ShieldCheck className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {recentAudit.map((log) => (
                <div key={log.id} className="border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800">
                  <div className="font-medium">{log.action}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {log.organization?.name || 'Platform'} · {log.userId ? 'user' : log.platformAdminId ? 'platform' : 'system'} · {log.createdAt.toLocaleString()}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
