import { db } from '@/db';
import { tickets, ticketComments, ticketTagAssignments } from '@/db/schema';
import {
  eq,
  and,
  or,
  like,
  isNull,
  inArray,
  gte,
  lte,
  desc,
  asc,
} from 'drizzle-orm';
import type { TicketFilters } from '@/lib/tickets/queries';
import { withOrgScope } from '@/lib/db/with-org-scope';

export interface ReportFilters extends TicketFilters {
  includeComments?: boolean;
  includeAttachments?: boolean;
  includeAuditLog?: boolean;
  groupBy?: 'status' | 'priority' | 'org' | 'assignee' | 'category' | 'none';
  sortBy?: 'created' | 'updated' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ReportData {
  tickets: Array<{
    key: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    organization: string;
    requester: string | null;
    requesterEmail: string | null;
    assignee: string | null;
    createdAt: Date;
    updatedAt: Date;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
    commentCount: number;
    attachmentCount: number;
    tags: string[];
  }>;
  summary: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
    byPriority: Array<{ priority: string; count: number }>;
    byOrg: Array<{ org: string; count: number }>;
    dateRange: { from: Date | null; to: Date | null };
  };
}

/**
 * Generate a report with optional org filtering
 * 
 * For customer users: orgId is required (enforced by withOrgScope)
 * For internal users: orgId is optional (can see all tickets)
 * 
 * @param filters - Report filter criteria including optional orgId
 * @returns Report data
 */
export async function generateReport(filters: ReportFilters): Promise<ReportData> {
  // If orgId is provided, use withOrgScope to enforce tenant isolation
  if (filters.orgId) {
    return withOrgScope(filters.orgId, async (orgId) => {
      return generateReportInternal({ ...filters, orgId });
    });
  }

  // Internal users can query without orgId (see all tickets)
  return generateReportInternal(filters);
}

/**
 * Internal implementation of generateReport
 */
async function generateReportInternal(filters: ReportFilters): Promise<ReportData> {
  const conditions = [];

  if (filters.orgId) {
    conditions.push(eq(tickets.orgId, filters.orgId));
  }

  if (filters.status && filters.status.length > 0) {
    conditions.push(inArray(tickets.status, filters.status));
  }

  if (filters.priority && filters.priority.length > 0) {
    conditions.push(inArray(tickets.priority, filters.priority));
  }

  if (filters.assigneeId === null) {
    conditions.push(isNull(tickets.assigneeId));
  } else if (filters.assigneeId) {
    conditions.push(eq(tickets.assigneeId, filters.assigneeId));
  }

  if (filters.requesterId) {
    conditions.push(eq(tickets.requesterId, filters.requesterId));
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    const searchConditions = [
      like(tickets.subject, searchPattern),
      like(tickets.description, searchPattern),
      like(tickets.key, searchPattern),
    ];

    if (filters.searchInComments) {
      const matchingCommentTickets = await db.query.ticketComments.findMany({
        where: like(ticketComments.content, searchPattern),
        columns: {
          ticketId: true,
        },
      });

      const ticketIdsWithMatchingComments = new Set(
        matchingCommentTickets.map((c) => c.ticketId)
      );

      if (ticketIdsWithMatchingComments.size > 0) {
        const ticketIdsArray = Array.from(ticketIdsWithMatchingComments);
        searchConditions.push(inArray(tickets.id, ticketIdsArray));
      }
    }

    conditions.push(or(...searchConditions)!);
  }

  if (filters.dateFrom) {
    conditions.push(gte(tickets.createdAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    const endDate = new Date(filters.dateTo);
    endDate.setDate(endDate.getDate() + 1);
    conditions.push(lte(tickets.createdAt, endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Determine sort order
  const sortOrder = filters.sortOrder === 'asc' ? asc : desc;
  let orderBy = [desc(tickets.createdAt)];

  if (filters.sortBy === 'updated') {
    orderBy = [sortOrder(tickets.updatedAt)];
  } else if (filters.sortBy === 'priority') {
    orderBy = [sortOrder(tickets.priority)];
  } else if (filters.sortBy === 'status') {
    orderBy = [sortOrder(tickets.status)];
  } else {
    orderBy = [sortOrder(tickets.createdAt)];
  }

  // Fetch tickets with relations
  let ticketResults = await db.query.tickets.findMany({
    where: whereClause,
    orderBy,
    with: {
      organization: {
        columns: {
          name: true,
        },
      },
      requester: {
        columns: {
          name: true,
          email: true,
        },
      },
      assignee: {
        columns: {
          name: true,
          email: true,
        },
      },
      tagAssignments: {
        with: {
          tag: {
            columns: {
              name: true,
            },
          },
        },
      },
      comments: {
        columns: {
          id: true,
        },
      },
      attachments: {
        columns: {
          id: true,
        },
      },
    },
  });

  // Filter by tags if specified
  if (filters.tagIds && filters.tagIds.length > 0) {
    const ticketsWithTags = await db.query.ticketTagAssignments.findMany({
      where: inArray(ticketTagAssignments.tagId, filters.tagIds),
      columns: {
        ticketId: true,
      },
    });

    const ticketIdsWithTags = new Set(ticketsWithTags.map((t) => t.ticketId));
    ticketResults = ticketResults.filter((t) => ticketIdsWithTags.has(t.id));
  }

  // Transform to report format
  const reportTickets = ticketResults.map((ticket) => ({
    key: ticket.key,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    organization: ticket.organization.name,
    requester: ticket.requester?.name || null,
    requesterEmail: ticket.requesterEmail || ticket.requester?.email || null,
    assignee: ticket.assignee?.name || null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    firstResponseAt: ticket.firstResponseAt || null,
    resolvedAt: ticket.resolvedAt || null,
    commentCount: ticket.comments.length,
    attachmentCount: ticket.attachments.length,
    tags: ticket.tagAssignments.map((ta) => ta.tag.name),
  }));

  // Generate summary
  const byStatus = new Map<string, number>();
  const byPriority = new Map<string, number>();
  const byOrg = new Map<string, number>();

  reportTickets.forEach((ticket) => {
    byStatus.set(ticket.status, (byStatus.get(ticket.status) || 0) + 1);
    byPriority.set(ticket.priority, (byPriority.get(ticket.priority) || 0) + 1);
    byOrg.set(ticket.organization, (byOrg.get(ticket.organization) || 0) + 1);
  });

  return {
    tickets: reportTickets,
    summary: {
      total: reportTickets.length,
      byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({
        status,
        count,
      })),
      byPriority: Array.from(byPriority.entries()).map(([priority, count]) => ({
        priority,
        count,
      })),
      byOrg: Array.from(byOrg.entries()).map(([org, count]) => ({
        org,
        count,
      })),
      dateRange: {
        from: filters.dateFrom || null,
        to: filters.dateTo || null,
      },
    },
  };
}
