import { db } from '@/db';
import {
  tickets,
  ticketComments,
  ticketPriorityEnum,
  ticketStatusEnum,
} from '@/db/schema';
import { eq, and, desc, asc, or, like, isNull, inArray } from 'drizzle-orm';

export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type TicketPriority = (typeof ticketPriorityEnum.enumValues)[number];

export interface TicketFilters {
  orgId?: string;
  status?: TicketStatus[];
  priority?: TicketPriority[];
  assigneeId?: string | null;
  requesterId?: string;
  search?: string;
}

export async function getTickets(filters: TicketFilters = {}) {
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
    conditions.push(
      or(
        like(tickets.subject, `%${filters.search}%`),
        like(tickets.description, `%${filters.search}%`),
        like(tickets.key, `%${filters.search}%`)
      )!
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return db.query.tickets.findMany({
    where: whereClause,
    orderBy: [desc(tickets.createdAt)],
    with: {
      organization: true,
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
    },
  });
}

export async function getTicketById(ticketId: string) {
  return db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    with: {
      organization: true,
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
        orderBy: [asc(ticketComments.createdAt)],
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
      attachments: true,
    },
  });
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
