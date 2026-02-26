/**
 * Storage quota management for organizations
 * 
 * Tracks and enforces per-organization storage limits for attachments
 */

import { db } from '@/db';
import { organizations, attachments } from '@/db/schema';
import { eq, sum, sql } from 'drizzle-orm';

const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10GB default

export interface QuotaStatus {
  usedBytes: number;
  quotaBytes: number;
  availableBytes: number;
  usagePercent: number;
  isExceeded: boolean;
}

/**
 * Get current storage quota status for an organization
 */
export async function getQuotaStatus(orgId: string | null): Promise<QuotaStatus> {
  // Public tickets (no org) have a default 100MB quota
  if (!orgId) {
    const PUBLIC_TICKET_QUOTA = 100 * 1024 * 1024; // 100MB
    return {
      usedBytes: 0,
      quotaBytes: PUBLIC_TICKET_QUOTA,
      availableBytes: PUBLIC_TICKET_QUOTA,
      usagePercent: 0,
      isExceeded: false,
    };
  }
  
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: {
      storageQuotaBytes: true,
      storageUsedBytes: true,
    },
  });

  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  const quotaBytes = org.storageQuotaBytes ?? DEFAULT_QUOTA_BYTES;
  const usedBytes = org.storageUsedBytes ?? 0;
  const availableBytes = Math.max(0, quotaBytes - usedBytes);
  const usagePercent = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
  const isExceeded = usedBytes >= quotaBytes;

  return {
    usedBytes,
    quotaBytes,
    availableBytes,
    usagePercent,
    isExceeded,
  };
}

/**
 * Check if an organization has enough quota for a file upload
 */
export async function checkQuota(orgId: string | null, fileSizeBytes: number): Promise<{
  allowed: boolean;
  status: QuotaStatus;
  error?: string;
}> {
  // Public tickets (no org) have a default 100MB quota
  if (!orgId) {
    const PUBLIC_TICKET_QUOTA = 100 * 1024 * 1024; // 100MB
    return {
      allowed: fileSizeBytes <= PUBLIC_TICKET_QUOTA,
      status: {
        usedBytes: 0,
        quotaBytes: PUBLIC_TICKET_QUOTA,
        availableBytes: PUBLIC_TICKET_QUOTA,
        usagePercent: 0,
        isExceeded: false,
      },
      error: fileSizeBytes > PUBLIC_TICKET_QUOTA 
        ? `File too large for public ticket. Max size: 100MB` 
        : undefined,
    };
  }
  
  const status = await getQuotaStatus(orgId);

  if (status.isExceeded) {
    return {
      allowed: false,
      status,
      error: 'Storage quota exceeded. Please contact your administrator.',
    };
  }

  if (status.availableBytes < fileSizeBytes) {
    return {
      allowed: false,
      status,
      error: `Insufficient storage space. Available: ${formatBytes(status.availableBytes)}, Required: ${formatBytes(fileSizeBytes)}`,
    };
  }

  return {
    allowed: true,
    status,
  };
}

/**
 * Update storage usage after an attachment is uploaded
 */
export async function incrementStorageUsage(orgId: string | null, sizeBytes: number): Promise<void> {
  // Skip for public tickets (no org)
  if (!orgId) return;
  
  await db
    .update(organizations)
    .set({
      storageUsedBytes: sql`COALESCE(${organizations.storageUsedBytes}, 0) + ${sizeBytes}`,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  // Also recalculate from actual attachments to ensure accuracy
  await recalculateStorageUsage(orgId);
}

/**
 * Update storage usage after an attachment is deleted
 */
export async function decrementStorageUsage(orgId: string | null, sizeBytes: number): Promise<void> {
  // Skip for public tickets (no org)
  if (!orgId) return;
  
  await db
    .update(organizations)
    .set({
      storageUsedBytes: sql`GREATEST(0, COALESCE(${organizations.storageUsedBytes}, 0) - ${sizeBytes})`,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  // Also recalculate from actual attachments to ensure accuracy
  await recalculateStorageUsage(orgId);
}

/**
 * Recalculate storage usage from actual attachments (for accuracy)
 */
export async function recalculateStorageUsage(orgId: string | null): Promise<number> {
  // Skip for public tickets (no org)
  if (!orgId) return 0;
  
  const result = await db
    .select({
      totalSize: sum(attachments.size),
    })
    .from(attachments)
    .where(eq(attachments.orgId, orgId));

  const totalSize = Number(result[0]?.totalSize ?? 0);

  await db
    .update(organizations)
    .set({
      storageUsedBytes: totalSize,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  return totalSize;
}

/**
 * Set storage quota for an organization
 */
export async function setStorageQuota(orgId: string, quotaBytes: number): Promise<void> {
  if (quotaBytes < 0) {
    throw new Error('Storage quota must be non-negative');
  }

  await db
    .update(organizations)
    .set({
      storageQuotaBytes: quotaBytes,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

