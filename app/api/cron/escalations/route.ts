import { NextRequest, NextResponse } from 'next/server';
import { processEscalationRules, checkSLAEscalations } from '@/lib/tickets/escalation';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      timestamp: new Date().toISOString(),
      escalations: null as Awaited<ReturnType<typeof processEscalationRules>> | null,
      sla: null as Awaited<ReturnType<typeof checkSLAEscalations>> | null,
    };

    try {
      results.escalations = await processEscalationRules();
    } catch (error) {
      console.error('Escalation processing error:', error);
      results.escalations = [];
    }

    try {
      results.sla = await checkSLAEscalations();
    } catch (error) {
      console.error('SLA check error:', error);
      results.sla = { warnings: [], breaches: [] };
    }

    const totalEscalations = results.escalations?.reduce(
      (sum, r) => sum + r.escalations, 
      0
    ) || 0;

    console.log('Escalation cron completed:', {
      escalations: totalEscalations,
      slaWarnings: results.sla?.warnings.length || 0,
      slaBreaches: results.sla?.breaches.length || 0,
    });

    return NextResponse.json({
      success: true,
      summary: {
        escalationsProcessed: totalEscalations,
        slaWarnings: results.sla?.warnings.length || 0,
        slaBreaches: results.sla?.breaches.length || 0,
      },
      details: results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
