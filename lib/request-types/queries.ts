import { db } from '@/db';
import { requestTypes } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { withOrgScope } from '@/lib/db/with-org-scope';

export async function getRequestTypes(orgId: string, options?: { includeInactive?: boolean }) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    return db.query.requestTypes.findMany({
      where: options?.includeInactive
        ? eq(requestTypes.orgId, scopedOrgId)
        : and(eq(requestTypes.orgId, scopedOrgId), eq(requestTypes.isActive, true)),
      orderBy: (table, { asc }) => [asc(table.name)],
    });
  });
}

export async function getRequestTypeById(orgId: string, id: string) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    const requestType = await db.query.requestTypes.findFirst({
      where: and(eq(requestTypes.id, id), eq(requestTypes.orgId, scopedOrgId)),
    });

    return requestType ?? null;
  });
}

export async function getRequestTypeBySlug(orgId: string, slug: string) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    return db.query.requestTypes.findFirst({
      where: and(eq(requestTypes.orgId, scopedOrgId), eq(requestTypes.slug, slug)),
    });
  });
}
