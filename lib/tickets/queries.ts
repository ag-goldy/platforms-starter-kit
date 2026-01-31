import { db } from '@/db';
import {
  tickets,
  ticketComments,
  ticketTagAssignments,
  ticketPriorityEnum,
  ticketStatusEnum,
} from '@/db/schema';
import { eq, and, desc, asc, or, like, isNull, inArray, sql, gte, lte } from 'drizzle-orm';
import { withOrgScope } from '@/lib/db/with-org-scope';

export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type TicketPriority = (typeof ticketPriorityEnum.enumValues)[number];

export interface TicketFilters {
  orgId?: string;
  status?: TicketStatus[];
  priority?: TicketPriority[];
  assigneeId?: string | null;
  requesterId?: string;
  siteId?: string;
  areaId?: string;
  requestTypeId?: string;
  search?: string;
  tagIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  searchInComments?: boolean;
}

/**
 * Get tickets with optional org filtering
 * 
 * For customer users: orgId is required (enforced by withOrgScope)
 * For internal users: orgId is optional (can see all tickets)
 * 
 * @param filters - Filter criteria including optional orgId
 * @returns Array of tickets matching the filters
 */
export async function getTickets(filters: TicketFilters = {}) {
  // If orgId is provided, use withOrgScope to enforce tenant isolation
  if (filters.orgId) {
    return withOrgScope(filters.orgId, async (orgId) => {
      return getTicketsInternal({ ...filters, orgId });
    });
  }

  // Internal users can query without orgId (see all tickets)
  // This should only be called from internal routes
  return getTicketsInternal(filters);
}

/**
 * Internal implementation of getTickets
 * Always includes orgId filter if provided
 */
async function getTicketsInternal(filters: TicketFilters) {
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

  if (filters.siteId) {
    conditions.push(eq(tickets.siteId, filters.siteId));
  }

  if (filters.areaId) {
    conditions.push(eq(tickets.areaId, filters.areaId));
  }

  if (filters.requestTypeId) {
    conditions.push(eq(tickets.requestTypeId, filters.requestTypeId));
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    const searchConditions = [
      like(tickets.subject, searchPattern),
      like(tickets.description, searchPattern),
      like(tickets.key, searchPattern),
    ];

    // If searching in comments, we'll need to do a subquery
    if (filters.searchInComments) {
      // Get ticket IDs that have matching comments
      const matchingCommentTickets = await db.query.ticketComments.findMany({
        where: like(ticketComments.content, searchPattern),
        columns: {
          ticketId: true,
        },
      });

      const ticketIdsWithMatchingComments = new Set(
        matchingCommentTickets.map((c) => c.ticketId)
      );

      // Add condition to include tickets with matching comments
      if (ticketIdsWithMatchingComments.size > 0) {
        searchConditions.push(
          sql`${tickets.id} IN (${sql.join(
            Array.from(ticketIdsWithMatchingComments).map((id) => sql`${id}`),
            sql`, `
          )})`
        );
      }
    }

    conditions.push(or(...searchConditions)!);
  }

  // Date range filtering
  if (filters.dateFrom) {
    conditions.push(gte(tickets.createdAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    // Add one day to include the entire end date
    const endDate = new Date(filters.dateTo);
    endDate.setDate(endDate.getDate() + 1);
    conditions.push(lte(tickets.createdAt, endDate));
  }

  // Add filter to exclude soft-deleted tickets
  const finalConditions = conditions.length > 0 ? [and(...conditions), isNull(tickets.deletedAt)] : [isNull(tickets.deletedAt)];
  const finalWhereClause = finalConditions.length > 1 ? and(...finalConditions) : finalConditions[0];

  let ticketResults = await db.query.tickets.findMany({
    where: finalWhereClause,
    orderBy: [desc(tickets.createdAt)],
    with: {
      organization: {
        columns: {
          id: true,
          name: true,
        },
      },
      requestType: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
      site: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
      area: {
        columns: {
          id: true,
          name: true,
        },
      },
      requester: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignee: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      tagAssignments: {
        with: {
          tag: true,
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

  return ticketResults;
}

/**
 * Get a ticket by ID
 * 
 * For customer users: orgId is required to ensure tenant isolation
 * For internal users: orgId is optional (can view any ticket)
 * 
 * @param ticketId - The ticket ID
 * @param orgId - Optional org ID for tenant scoping
 * @returns The ticket or null if not found
 */
export async function getTicketById(ticketId: string, orgId?: string) {
  const ticketQuery = {
    with: {
      organization: {
        columns: {
          id: true,
          name: true,
        },
      },
      requestType: {
        columns: {
          id: true,
          name: true,
          slug: true,
          description: true,
        },
      },
      site: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
      area: {
        columns: {
          id: true,
          name: true,
        },
      },
      requester: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignee: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      comments: {
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      attachments: {
        columns: {
          id: true,
          filename: true,
          contentType: true,
          size: true,
          blobPathname: true,
          storageKey: true,
          uploadedBy: true,
          scanStatus: true,
          scanResult: true,
          scannedAt: true,
          isQuarantined: true,
          createdAt: true,
          ticketId: true,
          orgId: true,
          commentId: true,
        },
      },
      ticketAssets: {
        with: {
          asset: {
            columns: {
              id: true,
              name: true,
              type: true,
              status: true,
              siteId: true,
              areaId: true,
            },
          },
        },
      },
      tagAssignments: {
        with: {
          tag: {
            columns: {
              id: true,
              name: true,
              color: true,
              createdAt: true,
            },
          },
        },
      },
    },
  };

  // If orgId is provided, use withOrgScope to enforce tenant isolation
  if (orgId) {
    return withOrgScope(orgId, async (scopedOrgId) => {
      const ticket = await db.query.tickets.findFirst({
        where: and(eq(tickets.id, ticketId), eq(tickets.orgId, scopedOrgId), isNull(tickets.deletedAt)),
        ...ticketQuery,
      });
      return ticket ?? null;
    });
  }

      // Internal users can query without orgId (see any ticket)
      const ticket = await db.query.tickets.findFirst({
        where: and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)),
    ...ticketQuery,
  });
  return ticket ?? null;
}

export async function getTicketComments(ticketId: string, includeInternal = false) {
  const conditions = [eq(ticketComments.ticketId, ticketId)];

  if (!includeInternal) {
    conditions.push(eq(ticketComments.isInternal, false));
  }

  return db.query.ticketComments.findMany({
    where: and(...conditions),
    orderBy: [asc(ticketComments.createdAt)],
    with: {
      user: true,
    },
  });
}
