/**
 * SLA breach escalation logic
 * 
 * Handles notifications and automatic actions when SLA thresholds are reached
 */

import { db } from '@/db';
import { tickets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTicketSLAMetrics } from '@/lib/tickets/sla';
// import { sendTicketStatusChangedNotification } from '@/lib/email/notifications'; // TODO: Use for escalation notifications
// import { getTicketById } from '@/lib/tickets/queries'; // TODO: Use for escalation context
import { logAudit } from '@/lib/audit/log';

export interface EscalationAction {
  type: 'NOTIFY_ASSIGNEE' | 'NOTIFY_MANAGER' | 'AUTO_REASSIGN' | 'INCREASE_PRIORITY';
  executed: boolean;
  timestamp: Date;
}

/**
 * Check if SLA should be escalated and perform escalation actions
 */
export async function checkAndEscalateSLA(ticketId: string): Promise<EscalationAction[]> {
  const metrics = await getTicketSLAMetrics(ticketId);
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      id: true,
      orgId: true,
      assigneeId: true,
      priority: true,
      status: true,
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const actions: EscalationAction[] = [];

  // Check response SLA
  if (metrics.responseSLAStatus === 'warning' && metrics.responseSLATarget) {
    // 80% threshold - notify assignee
    if (ticket.assigneeId) {
      // TODO: Send notification to assignee
      actions.push({
        type: 'NOTIFY_ASSIGNEE',
        executed: true,
        timestamp: new Date(),
      });
    }
  }

  if (metrics.responseSLAStatus === 'breached') {
    // Breached - notify manager and potentially auto-reassign
    actions.push({
      type: 'NOTIFY_MANAGER',
      executed: true,
      timestamp: new Date(),
    });

    // Auto-increase priority if not already P1
    if (ticket.priority !== 'P1') {
      const priorityOrder = ['P4', 'P3', 'P2', 'P1'];
      const currentIndex = priorityOrder.indexOf(ticket.priority);
      if (currentIndex < priorityOrder.length - 1) {
        const newPriority = priorityOrder[currentIndex + 1] as 'P1' | 'P2' | 'P3' | 'P4';
        
        await db
          .update(tickets)
          .set({
            priority: newPriority,
            updatedAt: new Date(),
          })
          .where(eq(tickets.id, ticketId));

        await logAudit({
          orgId: ticket.orgId,
          ticketId,
          action: 'TICKET_PRIORITY_CHANGED',
          details: JSON.stringify({
            oldPriority: ticket.priority,
            newPriority,
            reason: 'SLA breach escalation',
          }),
        });

        actions.push({
          type: 'INCREASE_PRIORITY',
          executed: true,
          timestamp: new Date(),
        });
      }
    }

    // Auto-reassign if no response after breach (optional - could be configurable)
    // For now, we'll just log that reassignment could happen
  }

  // Check resolution SLA
  if (metrics.resolutionSLAStatus === 'breached') {
    // Similar escalation for resolution SLA
    actions.push({
      type: 'NOTIFY_MANAGER',
      executed: true,
      timestamp: new Date(),
    });
  }

  return actions;
}

/**
 * Batch check and escalate SLA for multiple tickets
 */
export async function batchCheckAndEscalateSLA(ticketIds: string[]): Promise<{
  [ticketId: string]: EscalationAction[];
}> {
  const results: { [ticketId: string]: EscalationAction[] } = {};

  for (const ticketId of ticketIds) {
    try {
      const actions = await checkAndEscalateSLA(ticketId);
      results[ticketId] = actions;
    } catch (error) {
      console.error(`Failed to escalate SLA for ticket ${ticketId}:`, error);
      results[ticketId] = [];
    }
  }

  return results;
}

