import { db } from '@/db';
import { tickets, ticketComments, ticketStatusEnum } from '@/db/schema';
import { eq, and, gte, sql, count, inArray } from 'drizzle-orm';
import { withOrgScope } from '@/lib/db/with-org-scope';

export interface DashboardMetrics {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  ticketsByStatus: Array<{ status: string; count: number }>;
  ticketsByPriority: Array<{ priority: string; count: number }>;
  ticketsByOrg: Array<{ orgName: string; count: number }>;
  recentActivity: {
    ticketsCreated: number;
    commentsAdded: number;
  };
  averageResponseTime?: number;
  averageResolutionTime?: number;
}

/**
 * Get dashboard metrics with optional org filtering
 * 
 * For customer users: orgId is required (enforced by withOrgScope)
 * For internal users: orgId is optional (can see all metrics)
 * 
 * @param orgId - Optional organization ID for tenant scoping
 * @returns Dashboard metrics
 */
export async function getDashboardMetrics(orgId?: string): Promise<DashboardMetrics> {
  // If orgId is provided, use withOrgScope to enforce tenant isolation
  if (orgId) {
    return withOrgScope(orgId, async (scopedOrgId) => {
      return getDashboardMetricsInternal(scopedOrgId);
    });
  }

  // Internal users can query without orgId (see all metrics)
  return getDashboardMetricsInternal();
}

/**
 * Internal implementation of getDashboardMetrics
 */
async function getDashboardMetricsInternal(orgId?: string): Promise<DashboardMetrics> {
  const conditions = [];
  if (orgId) {
    conditions.push(eq(tickets.orgId, orgId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Total tickets
  const totalTicketsResult = await db
    .select({ count: count() })
    .from(tickets)
    .where(whereClause);

  const totalTickets = Number(totalTicketsResult[0]?.count ?? 0);

  // Open tickets (NEW, OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER)
  const openStatuses: (typeof ticketStatusEnum.enumValues)[number][] = [
    'NEW',
    'OPEN',
    'IN_PROGRESS',
    'WAITING_ON_CUSTOMER',
  ];
  
  const openConditions = [...conditions, inArray(tickets.status, openStatuses)];
  const openWhereClause = and(...openConditions);
  
  const openTicketsResult = await db
    .select({ count: count() })
    .from(tickets)
    .where(openWhereClause);

  const openTickets = Number(openTicketsResult[0]?.count ?? 0);

  // Resolved tickets
  const resolvedTicketsResult = await db
    .select({ count: count() })
    .from(tickets)
    .where(
      conditions.length > 0
        ? and(...conditions, eq(tickets.status, 'RESOLVED'))
        : eq(tickets.status, 'RESOLVED')
    );

  const resolvedTickets = Number(resolvedTicketsResult[0]?.count ?? 0);

  // Tickets by status
  const ticketsByStatusResult = await db
    .select({
      status: tickets.status,
      count: count(),
    })
    .from(tickets)
    .where(whereClause)
    .groupBy(tickets.status);

  const ticketsByStatus = ticketsByStatusResult.map((row) => ({
    status: row.status,
    count: Number(row.count),
  }));

  // Tickets by priority
  const ticketsByPriorityResult = await db
    .select({
      priority: tickets.priority,
      count: count(),
    })
    .from(tickets)
    .where(whereClause)
    .groupBy(tickets.priority);

  const ticketsByPriority = ticketsByPriorityResult.map((row) => ({
    priority: row.priority,
    count: Number(row.count),
  }));

  // Tickets by organization
  const ticketsByOrgResult = await db.query.tickets.findMany({
    where: whereClause,
    columns: {
      orgId: true,
    },
    with: {
      organization: {
        columns: {
          name: true,
        },
      },
    },
  });

  const orgCounts = new Map<string, number>();
  ticketsByOrgResult.forEach((ticket) => {
    const orgName = ticket.organization.name;
    orgCounts.set(orgName, (orgCounts.get(orgName) || 0) + 1);
  });

  const ticketsByOrg = Array.from(orgCounts.entries())
    .map(([orgName, count]) => ({ orgName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentTicketsResult = await db
    .select({ count: count() })
    .from(tickets)
    .where(
      conditions.length > 0
        ? and(...conditions, gte(tickets.createdAt, sevenDaysAgo))
        : gte(tickets.createdAt, sevenDaysAgo)
    );

  const ticketsCreated = Number(recentTicketsResult[0]?.count ?? 0);

  const recentCommentsResult = await db
    .select({ count: count() })
    .from(ticketComments)
    .where(gte(ticketComments.createdAt, sevenDaysAgo));

  const commentsAdded = Number(recentCommentsResult[0]?.count ?? 0);

  return {
    totalTickets,
    openTickets,
    resolvedTickets,
    ticketsByStatus,
    ticketsByPriority,
    ticketsByOrg,
    recentActivity: {
      ticketsCreated,
      commentsAdded,
    },
  };
}

export async function getTicketTrends(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const trends = await db
    .select({
      date: sql<string>`DATE(${tickets.createdAt})`,
      count: count(),
    })
    .from(tickets)
    .where(gte(tickets.createdAt, startDate))
    .groupBy(sql`DATE(${tickets.createdAt})`)
    .orderBy(sql`DATE(${tickets.createdAt})`);

  return trends.map((row) => ({
    date: row.date,
    count: Number(row.count),
  }));
}
