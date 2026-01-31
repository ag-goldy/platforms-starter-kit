import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { CustomerPortalShell } from '@/components/customer/portal-shell';
import { AssetsManager } from '@/components/assets/assets-manager';
import { db } from '@/db';
import { areas, assets, sites, requestTypes, exportRequests, ticketAssets } from '@/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function CustomerAssetsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  try {
    await requireOrgMemberRole(org.id, ['CUSTOMER_ADMIN']);

    const orgSites = await db.query.sites.findMany({
      where: eq(sites.orgId, org.id),
      orderBy: (table, { asc }) => [asc(table.name)],
    });
    const siteIds = orgSites.map((site) => site.id);

    const [orgAssets, orgAreas, requestTypeCountRows, exportCountRows] =
      await Promise.all([
        db.query.assets.findMany({
          where: eq(assets.orgId, org.id),
          orderBy: (table, { asc }) => [asc(table.name)],
          with: {
            site: true,
            area: true,
          },
        }),
        db.query.areas.findMany({
          where: siteIds.length > 0 ? inArray(areas.siteId, siteIds) : undefined,
          orderBy: (table, { asc }) => [asc(table.name)],
        }),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(requestTypes)
          .where(eq(requestTypes.orgId, org.id)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(exportRequests)
          .where(eq(exportRequests.orgId, org.id)),
      ]);

    const assetIds = orgAssets.map((asset) => asset.id);
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
    const exportCount = Number(exportCountRows[0]?.count ?? 0);

    const modules = [
      {
        title: 'Create Request',
        description: 'Service catalog and dynamic forms.',
        href: `/s/${subdomain}/tickets/new`,
        badge: 'New',
        count: requestTypeCount,
      },
      {
        title: 'Exports',
        description: 'Download customer export history.',
        href: `/s/${subdomain}/exports`,
        count: exportCount,
        footer: 'Admin only',
      },
      {
        title: 'Team',
        description: 'Manage users and offboarding.',
        href: `/s/${subdomain}/team`,
      },
      {
        title: 'Assets',
        description: 'Linked infrastructure inventory.',
        badge: 'Current',
        count: orgAssets.length,
      },
    ];

    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Assets</h1>
            <p className="text-sm text-gray-600">
              Manage assets linked to your support tickets.
            </p>
          </div>

          <AssetsManager
            orgId={org.id}
            assets={orgAssets}
            sites={orgSites}
            areas={orgAreas}
            scope="customer"
            basePath={`/s/${subdomain}/assets`}
            assetStats={assetStats}
            modules={modules}
          />
        </div>
      </CustomerPortalShell>
    );
  } catch {
    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="flex items-center justify-center py-12">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Access Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Customer admins can manage assets.
              </p>
            </CardContent>
          </Card>
        </div>
      </CustomerPortalShell>
    );
  }
}
