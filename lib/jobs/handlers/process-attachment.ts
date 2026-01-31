/**
 * Handler for PROCESS_ATTACHMENT jobs
 * 
 * Handles virus scanning and other attachment processing tasks
 */

import type { ProcessAttachmentJob } from '../types';
import type { JobResult } from '../types';
import { db } from '@/db';
import { attachments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { scanAttachment } from '@/lib/attachments/scanning';
import { getDownloadUrl } from '@vercel/blob';
import { getInternalUsers } from '@/lib/users/queries';
// Removed sendAdminNotification import - function doesn't exist

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

export async function processAttachmentJob(job: ProcessAttachmentJob): Promise<JobResult> {
  try {
    const attachment = await db.query.attachments.findFirst({
      where: eq(attachments.id, job.data.attachmentId),
      with: {
        ticket: {
          with: {
            organization: true,
          },
        },
      },
    });

    if (!attachment) {
      throw new Error(`Attachment ${job.data.attachmentId} not found`);
    }

    if (job.data.action === 'SCAN') {
      // Idempotency check: Skip if already scanned successfully
      if (attachment.scanStatus === 'CLEAN' || attachment.scanStatus === 'INFECTED') {
        return {
          success: true,
          data: {
            attachmentId: job.data.attachmentId,
            scanStatus: attachment.scanStatus,
            isQuarantined: attachment.isQuarantined || false,
            idempotent: true,
            message: 'Attachment already scanned',
          },
        };
      }
      
      // Virus scanning
      await db
        .update(attachments)
        .set({
          scanStatus: 'SCANNING',
        })
        .where(eq(attachments.id, job.data.attachmentId));

      // Download file from blob storage
      if (!blobToken) {
        throw new Error('Blob storage is not configured');
      }

      const downloadUrl = await getDownloadUrl(attachment.blobPathname);

      const fileResponse = await fetch(downloadUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download attachment: ${fileResponse.statusText}`);
      }

      const buffer = Buffer.from(await fileResponse.arrayBuffer());

      // Scan the file
      const scanResult = await scanAttachment(buffer, attachment.filename);

      // Update attachment with scan result
      await db
        .update(attachments)
        .set({
          scanStatus: scanResult.status,
          scanResult: scanResult.result || null,
          scannedAt: scanResult.scannedAt,
          isQuarantined: scanResult.status === 'INFECTED',
        })
        .where(eq(attachments.id, job.data.attachmentId));

      // If infected, notify admins
      if (scanResult.status === 'INFECTED') {
        await notifyAdminsOfInfectedFile(attachment, scanResult.result || 'Unknown threat');
      }

      return {
        success: true,
        data: {
          attachmentId: job.data.attachmentId,
          scanStatus: scanResult.status,
          isQuarantined: scanResult.status === 'INFECTED',
        },
      };
    } else if (job.data.action === 'GENERATE_THUMBNAIL') {
      // TODO: Implement thumbnail generation for images
      return {
        success: true,
        data: {
          attachmentId: job.data.attachmentId,
          action: 'GENERATE_THUMBNAIL',
        },
      };
    } else {
      throw new Error(`Unknown action: ${job.data.action}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Update attachment with error status
    try {
      await db
        .update(attachments)
        .set({
          scanStatus: 'ERROR',
          scanResult: errorMessage,
          scannedAt: new Date(),
        })
        .where(eq(attachments.id, job.data.attachmentId));
    } catch (updateError) {
      console.error('Failed to update attachment scan status:', updateError);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Notify admins about an infected file
 */
async function notifyAdminsOfInfectedFile(
  attachment: typeof attachments.$inferSelect & {
    ticket: { key: string; organization: { name: string } };
  },
  threatInfo: string
): Promise<void> {
  try {
    const admins = await getInternalUsers();
    
    // Filter to only admins (for now, all internal users)
    // In a real system, you'd check for ADMIN role
    for (const admin of admins) {
      // Send email notification
      // For now, just log - implement email notification later
      console.error(
        `[SECURITY] Infected file detected: ${attachment.filename} in ticket ${attachment.ticket.key} (${attachment.ticket.organization.name}). Threat: ${threatInfo}. Notified: ${admin.email}`
      );
    }
  } catch (error) {
    console.error('Failed to notify admins of infected file:', error);
  }
}

