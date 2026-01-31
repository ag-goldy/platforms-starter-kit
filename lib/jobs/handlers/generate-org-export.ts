/**
 * Handler for GENERATE_ORG_EXPORT jobs
 *
 * Generates a single JSON export for an organization and stores it in blob storage.
 */

import type { GenerateOrgExportJob, JobResult } from '../types';
import { db } from '@/db';
import { exportRequests } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { generateExportData } from '@/lib/compliance/export';
import { put } from '@vercel/blob';

const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

export async function processGenerateOrgExportJob(
  job: GenerateOrgExportJob
): Promise<JobResult> {
  try {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      throw new Error('Blob storage is not configured');
    }

    const request = await db.query.exportRequests.findFirst({
      where: and(
        eq(exportRequests.id, job.data.exportRequestId),
        eq(exportRequests.orgId, job.data.orgId)
      ),
    });

    if (!request) {
      throw new Error('Export request not found');
    }

    await db
      .update(exportRequests)
      .set({
        status: 'PROCESSING',
        jobId: job.id,
        updatedAt: new Date(),
      })
      .where(eq(exportRequests.id, request.id));

    const exportData = await generateExportData(job.data.orgId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `org-export-${exportData.organization.slug}-${timestamp}.json`;
    const path = `exports/org/${job.data.orgId}/${job.id}-${filename}`;

    const blob = await put(path, Buffer.from(JSON.stringify(exportData, null, 2)), {
      contentType: 'application/json',
      token: blobToken,
      access: 'public' as const,
    });

    const expiresAt = new Date(Date.now() + EXPORT_TTL_MS);

    await db
      .update(exportRequests)
      .set({
        status: 'COMPLETED',
        filename,
        blobPathname: blob.pathname,
        storageKey: blob.url || blob.pathname,
        expiresAt,
        completedAt: new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(exportRequests.id, request.id));

    return {
      success: true,
      data: {
        exportRequestId: request.id,
        filename,
        storageKey: blob.url || blob.pathname,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      await db
        .update(exportRequests)
        .set({
          status: 'FAILED',
          error: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(exportRequests.id, job.data.exportRequestId));
    } catch (updateError) {
      console.error('[Exports] Failed to update export request after error:', updateError);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
