import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/auth/cron';
import { autoCloseResolvedTickets } from '@/lib/tickets/lifecycle';

export async function GET(request: NextRequest) {
  const rejection = verifyCronAuth(request);
  if (rejection) return rejection;

  try {
    const results = await autoCloseResolvedTickets();
    return NextResponse.json({
      processedOrgs: results.length,
      closedTickets: results.reduce((sum, result) => sum + result.closed, 0),
      results,
    });
  } catch (error) {
    console.error('[Cron] Failed to auto-close tickets:', error);
    return NextResponse.json(
      { error: 'Failed to auto-close tickets' },
      { status: 500 }
    );
  }
}
