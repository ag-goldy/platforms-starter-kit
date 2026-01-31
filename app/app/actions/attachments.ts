'use server';

import { requireInternalRole, requireInternalAdmin } from '@/lib/auth/permissions';
import { getQuotaStatus, setStorageQuota, recalculateStorageUsage, formatBytes } from '@/lib/attachments/quota';
import { db } from '@/db';
import { attachments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { decrementStorageUsage } from '@/lib/attachments/quota';

/**
 * Get storage quota status for an organization
 */
export async function getQuotaStatusAction(orgId: string) {
  await requireInternalRole();
  return await getQuotaStatus(orgId);
}

/**
 * Set storage quota for an organization (admin only)
 */
export async function setStorageQuotaAction(orgId: string, quotaBytes: number) {
  await requireInternalAdmin();
  await setStorageQuota(orgId, quotaBytes);
  return { success: true };
}

/**
 * Recalculate storage usage for an organization (admin only)
 */
export async function recalculateStorageUsageAction(orgId: string) {
  await requireInternalAdmin();
  const totalSize = await recalculateStorageUsage(orgId);
  return { success: true, totalSize, formattedSize: formatBytes(totalSize) };
}

/**
 * Delete an attachment and update storage usage
 */
export async function deleteAttachmentAction(attachmentId: string) {
  await requireInternalRole();
  
  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, attachmentId),
    with: {
      ticket: true,
    },
  });

  if (!attachment) {
    throw new Error('Attachment not found');
  }

  // Delete the attachment
  await db.delete(attachments).where(eq(attachments.id, attachmentId));

  // Decrement storage usage
  await decrementStorageUsage(attachment.orgId, attachment.size);

  return { success: true };
}
