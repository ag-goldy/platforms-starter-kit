import { db } from '@/db';
import { organizations, tickets, ticketComments } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export interface SLAMetrics {
  firstResponseTime?: number; // in hours
  resolutionTime?: number; // in hours
  firstResponseAt?: Date;
  resolvedAt?: Date;
  responseSLAStatus?: 'met' | 'warning' | 'breached' | 'not_applicable';
  resolutionSLAStatus?: 'met' | 'warning' | 'breached' | 'not_applicable';
  responseSLATarget?: number; // in hours
  resolutionSLATarget?: number; // in hours
}

export type SLAPriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface OrgSLAPolicy {
  id?: string;
  slaResponseHoursP1: number | null;
  slaResponseHoursP2: number | null;
  slaResponseHoursP3: number | null;
  slaResponseHoursP4: number | null;
  slaResolutionHoursP1: number | null;
  slaResolutionHoursP2: number | null;
  slaResolutionHoursP3: number | null;
  slaResolutionHoursP4: number | null;
}

/**
 * Get default SLA targets based on priority
 */
export function getDefaultSLATargets(priority: string): {
  responseHours: number;
  resolutionHours: number;
} {
  switch (priority) {
    case 'P1':
      return { responseHours: 1, resolutionHours: 4 };
    case 'P2':
      return { responseHours: 4, resolutionHours: 24 };
    case 'P3':
      return { responseHours: 24, resolutionHours: 72 };
    case 'P4':
      return { responseHours: 48, resolutionHours: 168 }; // 7 days
    default:
      return { responseHours: 24, resolutionHours: 72 };
  }
}

/**
 * Resolve SLA targets using org policy if available
 */
export function resolveSLATargets(
  priority: string,
  policy?: OrgSLAPolicy | null
): { responseHours: number; resolutionHours: number } {
  const defaults = getDefaultSLATargets(priority);
  const allowedPriorities: SLAPriority[] = ['P1', 'P2', 'P3', 'P4'];
  if (!policy || !allowedPriorities.includes(priority as SLAPriority)) {
    return defaults;
  }

  const priorityKey = priority as SLAPriority;
  const responseKey = `slaResponseHours${priorityKey}` as const;
  const resolutionKey = `slaResolutionHours${priorityKey}` as const;

  return {
    responseHours: policy[responseKey] ?? defaults.responseHours,
    resolutionHours: policy[resolutionKey] ?? defaults.resolutionHours,
  };
}

/**
 * Get SLA targets for an organization and priority
 */
export async function getOrgSLATargets(
  orgId: string,
  priority: string
): Promise<{ responseHours: number; resolutionHours: number }> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: {
      slaResponseHoursP1: true,
      slaResponseHoursP2: true,
      slaResponseHoursP3: true,
      slaResponseHoursP4: true,
      slaResolutionHoursP1: true,
      slaResolutionHoursP2: true,
      slaResolutionHoursP3: true,
      slaResolutionHoursP4: true,
    },
  });

  return resolveSLATargets(priority, org);
}

/**
 * Calculate SLA status based on time and target
 */
export function calculateSLAStatus(
  timeHours: number | undefined,
  targetHours: number | undefined
): 'met' | 'warning' | 'breached' | 'not_applicable' {
  if (!timeHours || !targetHours) {
    return 'not_applicable';
  }

  const percentage = (timeHours / targetHours) * 100;

  if (percentage >= 100) {
    return 'breached';
  } else if (percentage >= 80) {
    return 'warning';
  } else {
    return 'met';
  }
}

/**
 * Get SLA metrics for a ticket
 */
export async function getTicketSLAMetrics(ticketId: string): Promise<SLAMetrics> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      id: true,
      orgId: true,
      createdAt: true,
      firstResponseAt: true,
      resolvedAt: true,
      slaResponseTargetHours: true,
      slaResolutionTargetHours: true,
      priority: true,
      status: true,
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Get default targets if not set
  let responseTarget = ticket.slaResponseTargetHours;
  let resolutionTarget = ticket.slaResolutionTargetHours;

  if (responseTarget == null || resolutionTarget == null) {
    const orgTargets = await getOrgSLATargets(ticket.orgId, ticket.priority);
    responseTarget = responseTarget ?? orgTargets.responseHours;
    resolutionTarget = resolutionTarget ?? orgTargets.resolutionHours;
  }

  // Helper to convert to Date if needed
  const toDate = (date: Date | string | null | undefined): Date | null => {
    if (!date) return null;
    if (date instanceof Date) return date;
    return new Date(date);
  };

  // Calculate first response time
  let firstResponseTime: number | undefined;
  let firstResponseAt = toDate(ticket.firstResponseAt);
  const createdAt = toDate(ticket.createdAt);

  if (!firstResponseAt) {
    // Find first public comment from internal user
    const comments = await db.query.ticketComments.findMany({
      where: and(
        eq(ticketComments.ticketId, ticketId),
        eq(ticketComments.isInternal, false)
      ),
      orderBy: [asc(ticketComments.createdAt)],
      with: {
        user: {
          columns: {
            isInternal: true,
          },
        },
      },
    });

    const firstInternalComment = comments.find((c) => c.user?.isInternal);
    if (firstInternalComment && createdAt) {
      const commentDate = toDate(firstInternalComment.createdAt);
      if (commentDate) {
        firstResponseAt = commentDate;
        firstResponseTime =
          (firstResponseAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      }
    }
  } else if (createdAt) {
    firstResponseTime =
      (firstResponseAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  }

  // Calculate resolution time
  let resolutionTime: number | undefined;
  const resolvedAt = toDate(ticket.resolvedAt);

  if (resolvedAt && createdAt) {
    resolutionTime = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  } else if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    // If resolved but no resolvedAt timestamp, use updatedAt as fallback
    const ticketWithUpdated = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
      columns: {
        updatedAt: true,
        status: true,
      },
    });
    if (ticketWithUpdated && createdAt) {
      const updatedAt = toDate(ticketWithUpdated.updatedAt);
      if (updatedAt) {
        resolutionTime = (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      }
    }
  }

  return {
    firstResponseTime,
    resolutionTime,
    firstResponseAt: firstResponseAt || undefined,
    resolvedAt: resolvedAt || undefined,
    responseSLAStatus: calculateSLAStatus(firstResponseTime, responseTarget),
    resolutionSLAStatus: calculateSLAStatus(resolutionTime, resolutionTarget),
    responseSLATarget: responseTarget,
    resolutionSLATarget: resolutionTarget,
  };
}

/**
 * Update first response timestamp when an internal user adds a public comment
 */
export async function updateFirstResponseTime(ticketId: string) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      id: true,
      firstResponseAt: true,
    },
  });

  // Only update if not already set
  if (ticket && !ticket.firstResponseAt) {
    await db
      .update(tickets)
      .set({ firstResponseAt: new Date() })
      .where(eq(tickets.id, ticketId));
  }
}

/**
 * Update resolution timestamp when ticket is resolved/closed
 */
export async function updateResolutionTime(ticketId: string, status: string) {
  if (status === 'RESOLVED' || status === 'CLOSED') {
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
      columns: {
        id: true,
        resolvedAt: true,
      },
    });

    // Only update if not already set
    if (ticket && !ticket.resolvedAt) {
      await db
        .update(tickets)
        .set({ resolvedAt: new Date() })
        .where(eq(tickets.id, ticketId));
    }
  }
}
