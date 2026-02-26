import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDashboardMetrics, getTicketTrends } from '@/lib/analytics/queries';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch metrics and trends in parallel
    const [metrics, trends] = await Promise.all([
      getDashboardMetrics(),
      getTicketTrends(30),
    ]);

    return NextResponse.json({ metrics, trends });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}
