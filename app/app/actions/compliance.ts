'use server';

import { requireInternalAdmin } from '@/lib/auth/permissions';
import { anonymizeUserData, deleteUserData, anonymizeTicketData, deleteTicketData } from '@/lib/compliance/anonymization';
import { getRetentionConfig } from '@/lib/compliance/retention';
import { createExportFiles } from '@/lib/compliance/export';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Anonymize all data for a user (by email)
 */
export async function anonymizeUserDataAction(email: string, orgId: string) {
  await requireInternalAdmin();
  const count = await anonymizeUserData(email, orgId);
  return { success: true, anonymized: count };
}

/**
 * Delete all data for a user (by email)
 */
export async function deleteUserDataAction(email: string, orgId: string) {
  await requireInternalAdmin();
  const count = await deleteUserData(email, orgId);
  return { success: true, deleted: count };
}

/**
 * Anonymize a single ticket
 */
export async function anonymizeTicketAction(ticketId: string) {
  await requireInternalAdmin();
  await anonymizeTicketData(ticketId);
  revalidatePath('/app');
  return { success: true };
}

/**
 * Delete a single ticket
 */
export async function deleteTicketAction(ticketId: string) {
  await requireInternalAdmin();
  await deleteTicketData(ticketId);
  revalidatePath('/app');
  return { success: true };
}

/**
 * Get retention policy for an organization
 */
export async function getRetentionPolicyAction(orgId: string) {
  await requireInternalAdmin();
  return getRetentionConfig(orgId);
}

/**
 * Update retention policy for an organization
 */
export async function updateRetentionPolicyAction(
  orgId: string,
  policy: 'KEEP_FOREVER' | 'DELETE_AFTER_DAYS' | 'ANONYMIZE_AFTER_DAYS',
  days: number | null
) {
  await requireInternalAdmin();

  if (policy !== 'KEEP_FOREVER' && (!days || days < 1)) {
    throw new Error('Days must be provided and greater than 0 for this policy');
  }

  await db
    .update(organizations)
    .set({
      retentionPolicy: policy,
      dataRetentionDays: policy === 'KEEP_FOREVER' ? null : days,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  revalidatePath('/app');
  return { success: true };
}

/**
 * Export all data for an organization
 */
export async function exportOrgDataAction(orgId: string) {
  await requireInternalAdmin();
  const files = await createExportFiles(orgId);
  return { success: true, files };
}
