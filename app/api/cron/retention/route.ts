import { NextRequest, NextResponse } from 'next/server';
import { applyRetentionPoliciesToAllOrgs } from '@/lib/compliance/retention';
import { secureEndpoint, logUnauthorizedAccess } from '@/lib/api/security';
import { getCorrelationId } from '@/lib/monitoring/correlation';

/**
 * POST /api/cron/retention
 * 
 * Cron job endpoint for applying data retention policies
 * Should be called daily (e.g., via Vercel Cron)
 * 
 * Secured with a secret token or internal auth
 */
export async function POST(request: NextRequest) {
  // Secure endpoint - allow CRON secret or internal auth
  const { authorized } = await secureEndpoint(request, {
    allowCron: true,
    requireInternal: true,
  });
  
  if (!authorized) {
    await logUnauthorizedAccess(request, 'Missing or invalid authentication', '/api/cron/retention');
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid CRON secret or internal authentication required' },
      { status: 401 }
    );
  }

  try {
    const correlationId = await getCorrelationId();
    const results = await applyRetentionPoliciesToAllOrgs();
    
    const summary = {
      totalOrgs: Object.keys(results).length,
      totalAnonymized: Object.values(results).reduce((sum, r) => sum + r.anonymized, 0),
      totalDeleted: Object.values(results).reduce((sum, r) => sum + r.deleted, 0),
      byOrg: results,
    };

    return NextResponse.json({
      success: true,
      message: 'Retention policies applied',
      summary,
      correlationId,
    });
  } catch (error) {
    const correlationId = await getCorrelationId();
    console.error('Error applying retention policies:', error);
    return NextResponse.json(
      { error: 'Failed to apply retention policies', correlationId },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/retention (for testing)
 */
export async function GET(request: NextRequest) {
  return POST(request);
}

