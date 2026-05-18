import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/auth/cron';
import { checkSLAEscalations, processEscalationRules } from '@/lib/tickets/escalation';

// This cron job should be called every 5 minutes.
export async function GET(request: NextRequest) {
  const rejection = verifyCronAuth(request);
  if (rejection) return rejection;

  const [sla, rules] = await Promise.all([
    checkSLAEscalations(),
    processEscalationRules(),
  ]);

  return NextResponse.json({
    warned: sla.warnings.length,
    breached: sla.breaches.length,
    rules,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
