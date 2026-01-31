import { db } from '@/db';
import { areas, sites } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { withOrgScope } from '@/lib/db/with-org-scope';

export async function getSites(orgId: string, options?: { includeInactive?: boolean }) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    return db.query.sites.findMany({
      where: options?.includeInactive
        ? eq(sites.orgId, scopedOrgId)
        : and(eq(sites.orgId, scopedOrgId), eq(sites.isActive, true)),
      orderBy: (table, { asc }) => [asc(table.name)],
    });
  });
}

export async function getSiteById(orgId: string, siteId: string) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, siteId), eq(sites.orgId, scopedOrgId)),
    });

    return site ?? null;
  });
}

export async function getAreasForSite(orgId: string, siteId: string, options?: { includeInactive?: boolean }) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, siteId), eq(sites.orgId, scopedOrgId)),
    });

    if (!site) {
      return [];
    }

    return db.query.areas.findMany({
      where: options?.includeInactive
        ? eq(areas.siteId, siteId)
        : and(eq(areas.siteId, siteId), eq(areas.isActive, true)),
      orderBy: (table, { asc }) => [asc(table.name)],
    });
  });
}
