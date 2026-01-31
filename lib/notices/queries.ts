import { db } from '@/db';
import { notices } from '@/db/schema';
import { and, eq, isNull, lte, gt, or } from 'drizzle-orm';
import { withOrgScope } from '@/lib/db/with-org-scope';

const severityRank: Record<string, number> = {
  CRITICAL: 3,
  WARN: 2,
  INFO: 1,
};

export async function getActiveNotices(orgId: string, siteId?: string | null) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    const now = new Date();

    const baseConditions = [
      eq(notices.orgId, scopedOrgId),
      eq(notices.isActive, true),
      or(isNull(notices.startsAt), lte(notices.startsAt, now)),
      or(isNull(notices.endsAt), gt(notices.endsAt, now)),
    ];

    const siteConditions = siteId
      ? or(isNull(notices.siteId), eq(notices.siteId, siteId))
      : isNull(notices.siteId);

    const results = await db.query.notices.findMany({
      where: and(...baseConditions, siteConditions),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    return results;
  });
}

export function pickPrimaryNotice(
  allNotices: Array<typeof notices.$inferSelect>
): typeof notices.$inferSelect | null {
  if (!allNotices.length) return null;

  const sorted = [...allNotices].sort((a, b) => {
    const severityDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    if (severityDiff !== 0) return severityDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return sorted[0] || null;
}
