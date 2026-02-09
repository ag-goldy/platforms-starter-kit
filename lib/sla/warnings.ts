import { db } from '@/db';
import { tickets, memberships } from '@/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { getTicketSLAMetrics, type SLAMetrics } from '@/lib/tickets/sla';
import { createNotification } from '@/lib/notifications/service';
import { logAudit } from '@/lib/audit/log';

// Warning thresholds as percentage of SLA target
const WARNING_THRESHOLDS = {
  CRITICAL: 0.9, // 90% - critical warning
  WARNING: 0.75, // 75% - warning
  NOTICE: 0.5,   // 50% - informational notice
} as const;

interface SLAWarning {
  ticketId: string;
  type: 'response' | 'resolution';
  threshold: keyof typeof WARNING_THRESHOLDS;
  hoursElapsed: number;
  hoursTarget: number;
  percentage: number;
  assignedTo: string | null;
}

/**
 * Check tickets for SLA warnings and send notifications
 * Should be called by a background job every 5-10 minutes
 */
export async function checkSLAWarnings(): Promise<{
  checked: number;
  warnings: SLAWarning[];
  notificationsSent: number;
}> {
  // Find open tickets that need checking
  const openTickets = await db.query.tickets.findMany({
    where: and(
      inArray(tickets.status, ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER']),
      isNull(tickets.slaPausedAt)
    ),
    columns: {
      id: true,
      orgId: true,
      assigneeId: true,
      key: true,
      subject: true,
    },
  });

  const warnings: SLAWarning[] = [];
  let notificationsSent = 0;

  for (const ticket of openTickets) {
    try {
      const metrics = await getTicketSLAMetrics(ticket.id);
      const ticketWarnings = await evaluateTicketSLA(ticket, metrics);
      
      for (const warning of ticketWarnings) {
        warnings.push(warning);
        
        // Send notification
        await sendSLAWarningNotification(ticket, warning);
        notificationsSent++;
        
        // Log audit event
        await logAudit({
          orgId: ticket.orgId,
          ticketId: ticket.id,
          action: 'TICKET_SLA_WARNING',
          details: JSON.stringify({
            type: warning.type,
            threshold: warning.threshold,
            percentage: Math.round(warning.percentage * 100),
          }),
        });
      }
    } catch (error) {
      console.error(`Failed to check SLA for ticket ${ticket.id}:`, error);
    }
  }

  return {
    checked: openTickets.length,
    warnings,
    notificationsSent,
  };
}

async function evaluateTicketSLA(
  ticket: { id: string; orgId: string; assigneeId: string | null; key: string; subject: string },
  metrics: SLAMetrics
): Promise<SLAWarning[]> {
  const warnings: SLAWarning[] = [];

  // Check response SLA
  if (metrics.responseSLATarget && !metrics.firstResponseAt) {
    const hoursElapsed = await getBusinessHoursElapsed(ticket.id);
    const percentage = hoursElapsed / metrics.responseSLATarget;

    const threshold = getThresholdLevel(percentage);
    if (threshold) {
      warnings.push({
        ticketId: ticket.id,
        type: 'response',
        threshold,
        hoursElapsed,
        hoursTarget: metrics.responseSLATarget,
        percentage,
        assignedTo: ticket.assigneeId,
      });
    }
  }

  // Check resolution SLA
  if (metrics.resolutionSLATarget && !metrics.resolvedAt) {
    const hoursElapsed = await getBusinessHoursElapsed(ticket.id);
    const percentage = hoursElapsed / metrics.resolutionSLATarget;

    const threshold = getThresholdLevel(percentage);
    if (threshold) {
      warnings.push({
        ticketId: ticket.id,
        type: 'resolution',
        threshold,
        hoursElapsed,
        hoursTarget: metrics.resolutionSLATarget,
        percentage,
        assignedTo: ticket.assigneeId,
      });
    }
  }

  return warnings;
}

function getThresholdLevel(percentage: number): keyof typeof WARNING_THRESHOLDS | null {
  if (percentage >= WARNING_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (percentage >= WARNING_THRESHOLDS.WARNING) return 'WARNING';
  if (percentage >= WARNING_THRESHOLDS.NOTICE) return 'NOTICE';
  return null;
}

async function getBusinessHoursElapsed(ticketId: string): Promise<number> {
  // Simplified - just use actual hours for now
  // In production, this should respect business hours configuration
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: { createdAt: true },
  });

  if (!ticket) return 0;

  const createdAt = new Date(ticket.createdAt);
  const now = new Date();
  return (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
}

async function sendSLAWarningNotification(
  ticket: { id: string; orgId: string; assigneeId: string | null; key: string; subject: string },
  warning: SLAWarning
): Promise<void> {
  const percentage = Math.round(warning.percentage * 100);
  const hoursRemaining = Math.max(0, warning.hoursTarget - warning.hoursElapsed);

  const typeMap = {
    response: 'First Response',
    resolution: 'Resolution',
  };

  const thresholdConfig = {
    CRITICAL: { title: '🚨 Critical', priority: 'high' },
    WARNING: { title: '⚠️ Warning', priority: 'medium' },
    NOTICE: { title: 'ℹ️ Notice', priority: 'low' },
  };

  const config = thresholdConfig[warning.threshold];

  // Notify assignee if exists
  if (ticket.assigneeId) {
    await createNotification({
      userId: ticket.assigneeId,
      type: warning.threshold === 'CRITICAL' ? 'TICKET_SLA_BREACH' : 'TICKET_SLA_WARNING',
      title: `${config.title}: SLA ${typeMap[warning.type]} at ${percentage}%`,
      message: `Ticket ${ticket.key}: ${typeMap[warning.type]} SLA is at ${percentage}% (${hoursRemaining.toFixed(1)}h remaining)`,
      data: {
        ticketId: ticket.id,
        ticketKey: ticket.key,
        slaType: warning.type,
        percentage,
        hoursRemaining,
        threshold: warning.threshold,
      },
      link: `/app/tickets/${ticket.id}`,
    });
  }

  // For critical warnings, also notify org admins
  if (warning.threshold === 'CRITICAL') {
    const admins = await db.query.memberships.findMany({
      where: and(
        eq(memberships.orgId, ticket.orgId),
        eq(memberships.role, 'ADMIN'),
        eq(memberships.isActive, true)
      ),
      with: {
        user: {
          columns: { id: true },
        },
      },
    });

    for (const admin of admins) {
      if (admin.user?.id && admin.user.id !== ticket.assigneeId) {
        await createNotification({
          userId: admin.user.id,
          type: 'TICKET_SLA_BREACH',
          title: `🚨 Critical SLA Warning: ${ticket.key}`,
          message: `Ticket ${ticket.key} is approaching ${typeMap[warning.type]} SLA breach (${percentage}%)`,
          data: {
            ticketId: ticket.id,
            ticketKey: ticket.key,
            slaType: warning.type,
            percentage,
          },
          link: `/app/tickets/${ticket.id}`,
        });
      }
    }
  }
}

// Re-export for job handler
export { WARNING_THRESHOLDS };
export type { SLAWarning };
