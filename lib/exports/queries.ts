import { db } from '@/db';
import { exportRequests } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { withOrgScope } from '@/lib/db/with-org-scope';

export async function createExportRequest(orgId: string, requestedById: string) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    const [request] = await db
      .insert(exportRequests)
      .values({
        orgId: scopedOrgId,
        requestedById,
        status: 'PENDING',
      })
      .returning();

    return request;
  });
}

export async function getExportRequests(orgId: string) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    return db.query.exportRequests.findMany({
      where: eq(exportRequests.orgId, scopedOrgId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      with: {
        requestedBy: {
          columns: { id: true, name: true, email: true },
        },
      },
    });
  });
}

export async function getExportRequestById(orgId: string, requestId: string) {
  return withOrgScope(orgId, async (scopedOrgId) => {
    return db.query.exportRequests.findFirst({
      where: and(eq(exportRequests.id, requestId), eq(exportRequests.orgId, scopedOrgId)),
      with: {
        requestedBy: {
          columns: { id: true, name: true, email: true },
        },
      },
    });
  });
}
