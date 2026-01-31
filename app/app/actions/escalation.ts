'use server';

import { requireInternalRole } from '@/lib/auth/permissions';
import { checkAndEscalateSLA, batchCheckAndEscalateSLA } from '@/lib/sla/escalation';

/**
 * Manually trigger SLA escalation check for a ticket
 */
export async function checkEscalationAction(ticketId: string) {
  await requireInternalRole();
  const actions = await checkAndEscalateSLA(ticketId);
  return { actions };
}

/**
 * Batch check escalation for multiple tickets
 */
export async function batchCheckEscalationAction(ticketIds: string[]) {
  await requireInternalRole();
  const results = await batchCheckAndEscalateSLA(ticketIds);
  return { results };
}

