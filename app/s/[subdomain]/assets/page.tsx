import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { AssetsManager } from '@/components/assets/assets-manager';
import { db } from '@/db';
import { areas, assets, sites, ticketAssets } from '@/db/schema';
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

    const [orgAssets, orgAreas] = await Promise.all([
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

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-sm text-gray-600">
            Manage assets linked to your support tickets.
          </p>
        </div>

        <AssetsManager
          orgId={org.id}
          assets={orgAssets as any}
          sites={orgSites}
          areas={orgAreas}
          scope="customer"
          basePath={`/s/${subdomain}/assets`}
          assetStats={assetStats}
        />
      </div>
    );
  } catch {
    return (
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
    );
  }
}
