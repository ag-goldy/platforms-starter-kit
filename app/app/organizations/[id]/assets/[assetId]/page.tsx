import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { assets, organizations, ticketAssets } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils/date';
import {
  ArrowLeft,
  Clock3,
  Cpu,
  HardDrive,
  LifeBuoy,
  MapPin,
  MonitorDot,
  Network,
  ShieldCheck,
} from 'lucide-react';

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string; assetId: string }>;
}) {
  await requireInternalRole();
  const { id: orgId, assetId } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    notFound();
  }

  const asset = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), eq(assets.orgId, orgId)),
    with: {
      site: true,
      area: true,
    },
  });

  if (!asset) {
    notFound();
  }

  const linkedTickets = await db.query.ticketAssets.findMany({
    where: eq(ticketAssets.assetId, assetId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    with: {
      ticket: {
        columns: {
          id: true,
          key: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      },
    },
  });
  const activeTicketCount = linkedTickets.filter((link) => {
    const ticket = link.ticket as { status?: string } | undefined;
    return ticket && ticket.status !== 'CLOSED' && ticket.status !== 'MERGED';
  }).length;

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={`/app/organizations/${orgId}/assets`}
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to assets
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{asset.type}</Badge>
              <Badge variant="outline">{asset.status}</Badge>
              {asset.monitoringEnabled ? (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Monitored
                </Badge>
              ) : (
                <Badge variant="outline">Not monitored</Badge>
              )}
              {asset.archived && <Badge variant="secondary">Archived</Badge>}
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{asset.name}</h1>
            <p className="mt-2 text-sm text-slate-500">{org.name}</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[520px]">
            <DetailMetric icon={LifeBuoy} label="Linked tickets" value={linkedTickets.length} detail={`${activeTicketCount} active`} />
            <DetailMetric icon={MonitorDot} label="Monitoring" value={asset.monitoringStatus || 'UNKNOWN'} detail={asset.lastSyncedAt ? `Synced ${formatDateTime(asset.lastSyncedAt)}` : 'No sync recorded'} />
            <DetailMetric icon={Clock3} label="Updated" value={formatDateTime(asset.updatedAt)} detail="Inventory record" />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" />
            Asset details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoLine icon={Cpu} label="Hostname" value={asset.hostname} />
            <InfoLine icon={Network} label="IP address" value={asset.ipAddress} />
            <InfoLine icon={ShieldCheck} label="Serial number" value={asset.serialNumber} />
            <InfoLine icon={HardDrive} label="Model" value={asset.model} />
            <InfoLine icon={HardDrive} label="Vendor" value={asset.vendor} />
            <InfoLine icon={Network} label="MAC address" value={asset.macAddress} />
            <InfoLine icon={MapPin} label="Site" value={(asset.site as { name?: string } | null)?.name} />
            <InfoLine icon={MapPin} label="Area" value={(asset.area as { name?: string } | null)?.name} />
          </div>
          {asset.tags && asset.tags.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium text-slate-500">Tags</div>
              <div className="flex flex-wrap gap-2">
                {asset.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
          {asset.notes && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-medium text-slate-500">Notes</div>
              <p className="whitespace-pre-wrap text-slate-700">{asset.notes}</p>
            </div>
          )}
        </CardContent>
        </Card>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MonitorDot className="h-4 w-4" />
                Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoLine icon={MonitorDot} label="Zabbix host ID" value={asset.zabbixHostId} />
              <InfoLine icon={Network} label="Zabbix host" value={asset.zabbixHostName} />
              <InfoLine icon={ShieldCheck} label="Uptime" value={asset.uptimePercentage ? `${asset.uptimePercentage}%` : null} />
              <InfoLine icon={Clock3} label="Last sync" value={asset.lastSyncedAt ? formatDateTime(asset.lastSyncedAt) : null} />
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="h-4 w-4" />
            Ticket history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {linkedTickets.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
              No tickets linked yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {linkedTickets.map((link) => {
                const ticket = link.ticket as { id: string; key: string; subject: string; status: string; priority: string } | undefined;
                return ticket ? (
                  <div key={ticket.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <Link
                          href={`/app/tickets/${ticket.id}`}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          {ticket.key}
                        </Link>
                        <p className="truncate text-sm text-slate-500">{ticket.subject}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Linked {formatDateTime(link.createdAt)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{ticket.status.replaceAll('_', ' ')}</Badge>
                      <Badge variant="outline">{ticket.priority}</Badge>
                    </div>
                </div>
                ) : null;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof HardDrive;
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 truncate font-medium text-slate-950 dark:text-white">
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HardDrive;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <Icon className="mt-0.5 h-4 w-4 text-slate-500" />
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-1 truncate text-sm font-medium text-slate-950 dark:text-white">
          {value || 'Not recorded'}
        </div>
      </div>
    </div>
  );
}
