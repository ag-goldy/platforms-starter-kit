import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import {
  assets as assetsTable,
  organizations,
  sites as sitesTable,
  areas as areasTable,
  requestTypes,
  notices,
  exportRequests,
  ticketAssets,
} from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { AssetsManager } from '@/components/assets/assets-manager';

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

  const [assets, areas, requestTypeCountRows, activeNoticeCountRows, exportCountRows] =
    await Promise.all([
      db.query.assets.findMany({
        where: eq(assetsTable.orgId, orgId),
        orderBy: (table, { asc }) => [asc(table.name)],
        with: {
          site: true,
          area: true,
        },
      }),
      db.query.areas.findMany({
        where: siteIds.length > 0 ? inArray(areasTable.siteId, siteIds) : undefined,
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

  const assetStats = assetStatsRows.reduce<Record<string, { ticketCount: number; lastLinkedAt: Date | null }>>(
    (acc, row) => {
      acc[row.assetId] = {
        ticketCount: Number(row.ticketCount ?? 0),
        lastLinkedAt: row.lastLinkedAt ?? null,
      };
      return acc;
    },
    {}
  );

  const requestTypeCount = Number(requestTypeCountRows[0]?.count ?? 0);
  const activeNoticeCount = Number(activeNoticeCountRows[0]?.count ?? 0);
  const exportCount = Number(exportCountRows[0]?.count ?? 0);

  const modules = [
    {
      title: 'Service Catalog',
      description: 'Request types and dynamic forms.',
      href: `/app/organizations/${orgId}/request-types`,
      badge: 'New',
      count: requestTypeCount,
    },
    {
      title: 'Sites & Areas',
      description: 'Locations, areas, and coverage.',
      href: `/app/organizations/${orgId}/sites`,
      count: sites.length,
    },
    {
      title: 'Notices',
      description: 'Maintenance and known issues banners.',
      href: `/app/organizations/${orgId}/notices`,
      count: activeNoticeCount,
      footer: 'Active',
    },
    {
      title: 'Exports',
      description: 'Customer data exports on demand.',
      href: org.subdomain ? `/s/${org.subdomain}/exports` : undefined,
      count: exportCount,
      footer: 'Customer portal',
    },
    {
      title: 'Assets',
      description: 'Linked infrastructure inventory.',
      badge: 'Current',
      count: assets.length,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/organizations/${orgId}`}
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          ← Back to organization
        </Link>
        <h1 className="text-2xl font-bold">Assets</h1>
        <p className="text-sm text-gray-600">Manage assets for {org.name}</p>
      </div>

      <AssetsManager
        orgId={orgId}
        assets={assets as any}
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
