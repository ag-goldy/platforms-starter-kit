'use server';

import { db } from '@/db';
import { auditLogs, users, organizations } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { and, eq, desc, gte, lte, sql, like, or } from 'drizzle-orm';
import { z } from 'zod';

const filterSchema = z.object({
  orgId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  search: z.string().optional(),
});

export type AuditLogFilters = z.infer<typeof filterSchema>;

export async function getAuditLogs(
  filters: AuditLogFilters,
  page: number = 1,
  pageSize: number = 50
) {
  await requireInternalRole();

  const validated = filterSchema.parse(filters);

  const conditions = [];

  if (validated.orgId) {
    conditions.push(eq(auditLogs.orgId, validated.orgId));
  }

  if (validated.userId) {
    conditions.push(eq(auditLogs.userId, validated.userId));
  }

  if (validated.action) {
    conditions.push(eq(auditLogs.action, validated.action as any));
  }

  if (validated.dateFrom) {
    conditions.push(gte(auditLogs.createdAt, validated.dateFrom));
  }

  if (validated.dateTo) {
    conditions.push(lte(auditLogs.createdAt, validated.dateTo));
  }

  if (validated.search) {
    conditions.push(
      or(
        like(auditLogs.action, `%${validated.search}%`),
        like(auditLogs.details || '', `%${validated.search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, total] = await Promise.all([
    db.query.auditLogs.findMany({
      where: whereClause,
      orderBy: [desc(auditLogs.createdAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause)
      .then((r) => r[0]?.count || 0),
  ]);

  return {
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getAuditLogStats(dateFrom?: Date, dateTo?: Date) {
  await requireInternalRole();

  const conditions = [];

  if (dateFrom) {
    conditions.push(gte(auditLogs.createdAt, dateFrom));
  }

  if (dateTo) {
    conditions.push(lte(auditLogs.createdAt, dateTo));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [actionStats, dailyStats] = await Promise.all([
    db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.action)
      .orderBy(desc(sql`count(*)`))
      .limit(10),

    db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(sql`DATE(${auditLogs.createdAt})`)
      .orderBy(desc(sql`DATE(${auditLogs.createdAt})`))
      .limit(30),
  ]);

  return {
    actionStats,
    dailyStats,
  };
}

export async function exportAuditLogs(
  filters: AuditLogFilters,
  format: 'csv' | 'json' = 'csv'
) {
  await requireInternalRole();

  const { logs } = await getAuditLogs(filters, 1, 10000);

  if (format === 'json') {
    return JSON.stringify(logs, null, 2);
  }

  // CSV format
  const headers = [
    'Timestamp',
    'Action',
    'User',
    'Organization ID',
    'Ticket ID',
    'Details',
    'IP Address',
  ];

  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    log.action,
    log.user?.name || log.user?.email || 'System',
    log.orgId || '-',
    log.ticketId || '-',
    log.details || '',
    log.ipAddress || '',
  ]);

  return [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell || '').replace(/"/g, '""');
          return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
        })
        .join(',')
    ),
  ].join('\n');
}

const ACTION_LABELS: Record<string, string> = {
  TICKET_CREATED: 'Ticket Created',
  TICKET_UPDATED: 'Ticket Updated',
  TICKET_STATUS_CHANGED: 'Status Changed',
  TICKET_ASSIGNED: 'Ticket Assigned',
  TICKET_PRIORITY_CHANGED: 'Priority Changed',
  TICKET_COMMENT_ADDED: 'Comment Added',
  TICKET_MERGED: 'Ticket Merged',
  TICKET_TAG_ADDED: 'Tag Added',
  TICKET_TAG_REMOVED: 'Tag Removed',
  USER_INVITED: 'User Invited',
  USER_ROLE_CHANGED: 'Role Changed',
  ORG_CREATED: 'Organization Created',
  ORG_UPDATED: 'Organization Updated',
  EXPORT_REQUESTED: 'Export Requested',
  MEMBERSHIP_DEACTIVATED: 'Membership Deactivated',
};

export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ');
}
