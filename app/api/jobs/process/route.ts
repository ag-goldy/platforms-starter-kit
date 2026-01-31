/**
 * Job processing endpoint
 * 
 * Triggered by Vercel Cron to process jobs from the queue
 * 
 * Cron schedule: Every minute
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAllQueues } from '@/lib/jobs/worker';
import { getQueueDepth, getProcessingCount, getFailedCount } from '@/lib/jobs/queue';
import { secureEndpoint, logUnauthorizedAccess } from '@/lib/api/security';
import { getCorrelationId } from '@/lib/monitoring/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Secure endpoint - allow CRON secret or internal auth
  const { authorized } = await secureEndpoint(request, {
    allowCron: true,
    requireInternal: true,
  });
  
  if (!authorized) {
    await logUnauthorizedAccess(request, 'Missing or invalid authentication', '/api/jobs/process');
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid CRON secret or internal authentication required' },
      { status: 401 }
    );
  }

  try {
    const correlationId = await getCorrelationId();
    
    // Process all job queues (max 10 jobs per type)
    const results = await processAllQueues(10);

    // Get queue stats
    const stats = {
      SEND_EMAIL: {
        queue: await getQueueDepth('SEND_EMAIL'),
        processing: await getProcessingCount('SEND_EMAIL'),
        failed: await getFailedCount('SEND_EMAIL'),
        processed: results.SEND_EMAIL,
      },
      GENERATE_EXPORT: {
        queue: await getQueueDepth('GENERATE_EXPORT'),
        processing: await getProcessingCount('GENERATE_EXPORT'),
        failed: await getFailedCount('GENERATE_EXPORT'),
        processed: results.GENERATE_EXPORT,
      },
      GENERATE_ORG_EXPORT: {
        queue: await getQueueDepth('GENERATE_ORG_EXPORT'),
        processing: await getProcessingCount('GENERATE_ORG_EXPORT'),
        failed: await getFailedCount('GENERATE_ORG_EXPORT'),
        processed: results.GENERATE_ORG_EXPORT,
      },
      RECALCULATE_SLA: {
        queue: await getQueueDepth('RECALCULATE_SLA'),
        processing: await getProcessingCount('RECALCULATE_SLA'),
        failed: await getFailedCount('RECALCULATE_SLA'),
        processed: results.RECALCULATE_SLA,
      },
      PROCESS_ATTACHMENT: {
        queue: await getQueueDepth('PROCESS_ATTACHMENT'),
        processing: await getProcessingCount('PROCESS_ATTACHMENT'),
        failed: await getFailedCount('PROCESS_ATTACHMENT'),
        processed: results.PROCESS_ATTACHMENT,
      },
      AUDIT_COMPACTION: {
        queue: await getQueueDepth('AUDIT_COMPACTION'),
        processing: await getProcessingCount('AUDIT_COMPACTION'),
        failed: await getFailedCount('AUDIT_COMPACTION'),
        processed: results.AUDIT_COMPACTION,
      },
    };

    return NextResponse.json({
      success: true,
      processed: results,
      stats,
      correlationId,
    });
  } catch (error) {
    const correlationId = await getCorrelationId();
    console.error('[Jobs] Processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        correlationId,
      },
      { status: 500 }
    );
  }
}
