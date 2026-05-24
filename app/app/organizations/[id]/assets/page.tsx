import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalRole } from "@/lib/auth/permissions";
import { db } from "@/db";
import {
  assets as assetsTable,
  organizations,
  sites as sitesTable,
  areas as areasTable,
  requestTypes,
  notices,
  exportRequests,
  ticketAssets,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { AssetsManager } from "@/components/assets/assets-manager";
import type { Asset, Site, Area } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Database,
  HardDrive,
  LifeBuoy,
  MapPin,
  MonitorDot,
  PanelTop,
} from "lucide-react";

export default async function OrganizationAssetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const { id: orgId } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    notFound();
  }

  const sites = await db.query.sites.findMany({
    where: eq(sitesTable.orgId, orgId),
    orderBy: (table, { asc }) => [asc(table.name)],
  });
  const siteIds = sites.map((site) => site.id);

  const [
    assets,
    areas,
    requestTypeCountRows,
    activeNoticeCountRows,
    exportCountRows,
  ] = await Promise.all([
    db.query.assets.findMany({
      where: eq(assetsTable.orgId, orgId),
      orderBy: (table, { asc }) => [asc(table.name)],
      with: {
        site: true,
        area: true,
      },
    }),
    db.query.areas.findMany({
      where:
        siteIds.length > 0 ? inArray(areasTable.siteId, siteIds) : undefined,
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(requestTypes)
      .where(eq(requestTypes.orgId, orgId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notices)
      .where(and(eq(notices.orgId, orgId), eq(notices.isActive, true))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(exportRequests)
      .where(eq(exportRequests.orgId, orgId)),
  ]);

  const assetIds = assets.map((asset) => asset.id);
  const assetStatsRows =
    assetIds.length > 0
      ? await db
          .select({
            assetId: ticketAssets.assetId,
            ticketCount: sql<number>`count(*)::int`,
            lastLinkedAt: sql<Date | null>`max(${ticketAssets.createdAt})`,
          })
          .from(ticketAssets)
          .where(inArray(ticketAssets.assetId, assetIds))
          .groupBy(ticketAssets.assetId)
      : [];

  const assetStats = assetStatsRows.reduce<
    Record<string, { ticketCount: number; lastLinkedAt: Date | null }>
  >((acc, row) => {
    acc[row.assetId] = {
      ticketCount: Number(row.ticketCount ?? 0),
      lastLinkedAt: row.lastLinkedAt ?? null,
    };
    return acc;
  }, {});

  const requestTypeCount = Number(requestTypeCountRows[0]?.count ?? 0);
  const activeNoticeCount = Number(activeNoticeCountRows[0]?.count ?? 0);
  const exportCount = Number(exportCountRows[0]?.count ?? 0);
  const monitoredAssetCount = assets.filter((asset) => asset.monitoringEnabled).length;
  const archivedAssetCount = assets.filter((asset) => asset.archived).length;
  const linkedTicketCount = Object.values(assetStats).reduce(
    (total, stats) => total + stats.ticketCount,
    0,
  );

  const modules = [
    {
      title: "Service Catalog",
      description: "Request types and dynamic forms.",
      href: `/app/organizations/${orgId}/request-types`,
      badge: "New",
      count: requestTypeCount,
    },
    {
      title: "Sites & Areas",
      description: "Locations, areas, and coverage.",
      href: `/app/organizations/${orgId}/sites`,
      count: sites.length,
    },
    {
      title: "Notices",
      description: "Maintenance and known issues banners.",
      href: `/app/organizations/${orgId}/notices`,
      count: activeNoticeCount,
      footer: "Active",
    },
    {
      title: "Exports",
      description: "Customer data exports on demand.",
      href: org.subdomain ? `/s/${org.subdomain}/exports` : undefined,
      count: exportCount,
      footer: "Customer portal",
    },
    {
      title: "Assets",
      description: "Linked infrastructure inventory.",
      badge: "Current",
      count: assets.length,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={`/app/organizations/${orgId}`}
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to organization
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <HardDrive className="h-4 w-4" />
              Asset Inventory
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
            <p className="mt-1 text-sm text-slate-500">
              Infrastructure inventory, ticket linkage, location coverage, and Zabbix monitoring for {org.name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{sites.length} sites</Badge>
            <Badge variant="outline">{areas.length} areas</Badge>
            <Badge variant="outline">{archivedAssetCount} archived</Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AssetMetric icon={Database} label="Assets" value={assets.length} detail={`${archivedAssetCount} archived`} />
        <AssetMetric icon={MonitorDot} label="Monitored" value={monitoredAssetCount} detail="Zabbix-enabled assets" />
        <AssetMetric icon={LifeBuoy} label="Linked tickets" value={linkedTicketCount} detail="Across inventory" />
        <AssetMetric icon={PanelTop} label="Request types" value={requestTypeCount} detail="ITSM catalog forms" />
      </section>

      <AssetsManager
        orgId={orgId}
        assets={
          assets as (Asset & {
            site?: Site | null;
            area?: Area | null;
            archivedByUser?: {
              id: string;
              name: string | null;
              email: string;
            } | null;
          })[]
        }
        sites={sites}
        areas={areas}
        scope="internal"
        basePath={`/app/organizations/${orgId}/assets`}
        assetStats={assetStats}
        modules={modules}
      />
    </div>
  );
}

function AssetMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof MapPin;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}
