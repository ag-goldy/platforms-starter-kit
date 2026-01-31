'use server';

import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { enqueueJob } from '@/lib/jobs/queue';
import { createExportRequest, getExportRequests } from '@/lib/exports/queries';
import { db } from '@/db';
import { exportRequests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { appBaseUrl } from '@/lib/utils';
import { generateSignedExportUrl } from '@/lib/exports/signed-urls';
import { logAudit } from '@/lib/audit/log';

export async function requestOrgExportAction(orgId: string) {
  const { user } = await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const request = await createExportRequest(orgId, user.id);
  const jobId = await enqueueJob({
    type: 'GENERATE_ORG_EXPORT',
    maxAttempts: 3,
    data: {
      exportRequestId: request.id,
      orgId,
      requestedById: user.id,
    },
  });

  await db
    .update(exportRequests)
    .set({ jobId, updatedAt: new Date() })
    .where(eq(exportRequests.id, request.id));

  await logAudit({
    userId: user.id,
    orgId,
    action: 'EXPORT_REQUESTED',
    details: JSON.stringify({ exportRequestId: request.id }),
  });

  return { success: true, requestId: request.id, jobId };
}

export async function getOrgExportRequestsAction(orgId: string) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
  const requests = await getExportRequests(orgId);
  const now = new Date();

  return requests.map((request) => {
    const isExpired = request.expiresAt ? request.expiresAt < now : false;
    const downloadUrl =
      request.status === 'COMPLETED' && request.storageKey && !isExpired
        ? generateSignedExportUrl(appBaseUrl, {
            exportRequestId: request.id,
            orgId,
          })
        : null;

    return {
      ...request,
      downloadUrl,
      isExpired,
    };
  });
}
