'use server';

import { requireInternalRole } from '@/lib/auth/permissions';
import { getTicketSLAMetrics } from '@/lib/tickets/sla';
import { db } from '@/db';
import { tickets } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getTicketSLAAction(ticketId: string) {
  await requireInternalRole();
  return await getTicketSLAMetrics(ticketId);
}

export async function getSLAReportAction(orgId?: string) {
  await requireInternalRole();

  const conditions = [];
  if (orgId) {
    conditions.push(eq(tickets.orgId, orgId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const allTickets = await db.query.tickets.findMany({
    where: whereClause,
    columns: {
      id: true,
      key: true,
      status: true,
      priority: true,
      createdAt: true,
      firstResponseAt: true,
      resolvedAt: true,
      slaResponseTargetHours: true,
      slaResolutionTargetHours: true,
    },
  });

  const metrics = await Promise.all(
    allTickets.map(async (ticket) => {
      const sla = await getTicketSLAMetrics(ticket.id);
      return {
        ticketId: ticket.id,
        ticketKey: ticket.key,
        priority: ticket.priority,
        status: ticket.status,
        ...sla,
      };
    })
  );

  // Calculate aggregate metrics
  const totalTickets = metrics.length;
  const ticketsWithResponse = metrics.filter((m) => m.firstResponseAt);
  const ticketsResolved = metrics.filter((m) => m.resolvedAt);

  const responseMetrics = {
    total: ticketsWithResponse.length,
    met: ticketsWithResponse.filter((m) => m.responseSLAStatus === 'met').length,
    warning: ticketsWithResponse.filter((m) => m.responseSLAStatus === 'warning').length,
    breached: ticketsWithResponse.filter((m) => m.responseSLAStatus === 'breached').length,
    averageTime: ticketsWithResponse.reduce((sum, m) => sum + (m.firstResponseTime || 0), 0) /
      (ticketsWithResponse.length || 1),
  };

  const resolutionMetrics = {
    total: ticketsResolved.length,
    met: ticketsResolved.filter((m) => m.resolutionSLAStatus === 'met').length,
    warning: ticketsResolved.filter((m) => m.resolutionSLAStatus === 'warning').length,
    breached: ticketsResolved.filter((m) => m.resolutionSLAStatus === 'breached').length,
    averageTime: ticketsResolved.reduce((sum, m) => sum + (m.resolutionTime || 0), 0) /
      (ticketsResolved.length || 1),
  };

  return {
    totalTickets,
    responseMetrics,
    resolutionMetrics,
    tickets: metrics,
  };
}

