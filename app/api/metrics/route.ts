import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '@/lib/monitoring/metrics';
import { secureEndpoint, logUnauthorizedAccess } from '@/lib/api/security';
import { getCorrelationId } from '@/lib/monitoring/correlation';

/**
 * GET /api/metrics
 * Returns current system metrics
 * Requires internal role authentication
 */
export async function GET(request: NextRequest) {
  // Secure endpoint - require internal auth
  const { authorized } = await secureEndpoint(request, {
    requireInternal: true,
  });
  
  if (!authorized) {
    await logUnauthorizedAccess(request, 'Missing or invalid authentication', '/api/metrics');
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Internal authentication required' },
      { status: 403 }
    );
  }

  try {
    const correlationId = await getCorrelationId();
    const metrics = await getMetrics();
    return NextResponse.json({ ...metrics, correlationId }, { status: 200 });
  } catch (error) {
    const correlationId = await getCorrelationId();
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', correlationId },
      { status: 500 }
    );
  }
}

