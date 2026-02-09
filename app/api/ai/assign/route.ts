import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findBestAgent, autoAssignTicket, getWorkloadDistribution } from '@/lib/ai/assignment';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orgId, category, priority, ticketId, action } = body;

    if (action === 'workload') {
      const distribution = await getWorkloadDistribution(orgId);
      return NextResponse.json({ distribution });
    }

    if (ticketId) {
      const result = await autoAssignTicket(ticketId);
      return NextResponse.json(result);
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Org ID is required' }, { status: 400 });
    }

    const recommendation = await findBestAgent(orgId, {
      category,
      priority,
    });

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error('[AI Assign] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get assignment recommendation' },
      { status: 500 }
    );
  }
}
