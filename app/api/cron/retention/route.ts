import { NextRequest, NextResponse } from 'next/server';
import { applyRetentionPoliciesToAllOrgs } from '@/lib/compliance/retention';
import { getCorrelationId } from '@/lib/monitoring/correlation';
import { verifyCronAuth } from '@/lib/auth/cron';

/**
 * POST /api/cron/retention
 *
 * Cron job endpoint for applying data retention policies.
 * Should be called daily (e.g., via Vercel Cron).
 *
 * Authentication: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  // Fail-closed: rejects if CRON_SECRET not set or header mismatch
  const rejection = verifyCronAuth(request);
  if (rejection) return rejection;

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

