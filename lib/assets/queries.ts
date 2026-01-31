import { db } from '@/db';
import { assets, ticketAssets } from '@/db/schema';
import type { Asset } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { withOrgScope } from '@/lib/db/with-org-scope';

export async function getAssets(
  orgId: string,
  options?: {
    siteId?: string | null;
    areaId?: string | null;
    status?: Asset['status'];
    includeRetired?: boolean;
  }
) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    const conditions = [eq(assets.orgId, scopedOrgId)];

    if (options?.siteId) {
      conditions.push(eq(assets.siteId, options.siteId));
    }

    if (options?.areaId) {
      conditions.push(eq(assets.areaId, options.areaId));
    }

    if (options?.status) {
      conditions.push(eq(assets.status, options.status));
    } else if (!options?.includeRetired) {
      conditions.push(eq(assets.status, 'ACTIVE'));
    }

    return db.query.assets.findMany({
      where: and(...conditions),
      orderBy: (table, { asc }) => [asc(table.name)],
    });
  });
}

export async function getAssetById(orgId: string, assetId: string) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.orgId, scopedOrgId)),
    });

    return asset ?? null;
  });
}

export async function getTicketAssets(ticketId: string) {
  const links = await db.query.ticketAssets.findMany({
    where: eq(ticketAssets.ticketId, ticketId),
    with: {
      asset: true,
    },
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  return links.filter((link) => link.asset);
}
