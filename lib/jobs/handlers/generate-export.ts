/**
 * Handler for GENERATE_EXPORT jobs
 * 
 * Generates CSV or JSON exports in the background and stores them in blob storage
 */

import type { GenerateExportJob } from '../types';
import type { JobResult } from '../types';
import { generateReport, type ReportFilters } from '@/lib/reports/queries';
import { put } from '@vercel/blob';
import crypto from 'crypto';

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

export async function processGenerateExportJob(job: GenerateExportJob): Promise<JobResult> {
  try {
    if (!blobToken) {
      throw new Error('Blob storage is not configured');
    }

    const report = await generateReport(job.data.filters as ReportFilters);

    let content: string;
    let filename: string;
    let contentType: string;

    if (job.data.format === 'CSV') {
      // Generate CSV with full ticket details
      const headers = [
        'Key',
        'Subject',
        'Status',
        'Priority',
        'Category',
        'Organization',
        'Requester',
        'Requester Email',
        'Assignee',
        'Created At',
        'Updated At',
        'First Response At',
        'Resolved At',
        'Comment Count',
        'Attachment Count',
        'Tags',
      ];

      const rows = report.tickets.map((ticket) => [
        ticket.key,
        ticket.subject,
        ticket.status,
        ticket.priority,
        ticket.category,
        ticket.organization,
        ticket.requester || '',
        ticket.requesterEmail || '',
        ticket.assignee || '',
        ticket.createdAt.toISOString(),
        ticket.updatedAt.toISOString(),
        ticket.firstResponseAt?.toISOString() || '',
        ticket.resolvedAt?.toISOString() || '',
        ticket.commentCount.toString(),
        ticket.attachmentCount.toString(),
        ticket.tags.join('; '),
      ]);

      content = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');
      
      filename = `ticket-export-${Date.now()}.csv`;
      contentType = 'text/csv';
    } else {
      // Generate JSON
      content = JSON.stringify(report, null, 2);
      filename = `ticket-export-${Date.now()}.json`;
      contentType = 'application/json';
    }

    // Store export file in blob storage
    const path = `exports/${job.data.userId}/${crypto.randomUUID()}-${filename}`;
    const buffer = Buffer.from(content, 'utf-8');
    
    const blob = await put(path, buffer, {
      contentType,
      token: blobToken,
      access: 'public' as const,
    });

    // Return download URL
    return {
      success: true,
      data: {
        filename,
        downloadUrl: blob.url,
        contentLength: content.length,
        jobId: job.id,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

