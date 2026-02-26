'use server';

import { db } from '@/db';
import { aiAuditLog } from '@/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { requireInternalRole } from '@/lib/auth/permissions';

export interface AIAuditFilters {
  interface?: 'public' | 'customer' | 'admin';
  orgId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  piiDetected?: boolean;
  wasFiltered?: boolean;
}

export async function getAIAuditLogsAction(
  filters: AIAuditFilters = {},
  limit: number = 100,
  offset: number = 0
) {
  await requireInternalRole();

  const conditions = [];

  if (filters.interface) {
    conditions.push(eq(aiAuditLog.interface, filters.interface));
  }
  if (filters.orgId) {
    conditions.push(eq(aiAuditLog.orgId, filters.orgId));
  }
  if (filters.userId) {
    conditions.push(eq(aiAuditLog.userId, filters.userId));
  }
  if (filters.startDate) {
    conditions.push(gte(aiAuditLog.createdAt, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(aiAuditLog.createdAt, filters.endDate));
  }
  if (filters.piiDetected !== undefined) {
    conditions.push(eq(aiAuditLog.piiDetected, filters.piiDetected));
  }
  if (filters.wasFiltered !== undefined) {
    conditions.push(eq(aiAuditLog.wasFiltered, filters.wasFiltered));
  }

  const logs = await db.query.aiAuditLog.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(aiAuditLog.createdAt),
    limit,
    offset,
    with: {
      org: {
        columns: { name: true },
      },
      user: {
        columns: { name: true, email: true },
      },
    },
  });

  return logs;
}

export async function getAIAuditStatsAction(
  filters: AIAuditFilters = {}
) {
  await requireInternalRole();

  const conditions = [];

  if (filters.startDate) {
    conditions.push(gte(aiAuditLog.createdAt, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(aiAuditLog.createdAt, filters.endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [
    totalQueries,
    piiDetected,
    filtered,
    avgResponseTime,
    byInterface,
  ] = await Promise.all([
    // Total queries
    db.select({ count: sql<number>`count(*)` }).from(aiAuditLog).where(whereClause),
    // PII detected
    db.select({ count: sql<number>`count(*)` }).from(aiAuditLog).where(
      whereClause ? and(whereClause, eq(aiAuditLog.piiDetected, true)) : eq(aiAuditLog.piiDetected, true)
    ),
    // Filtered responses
    db.select({ count: sql<number>`count(*)` }).from(aiAuditLog).where(
      whereClause ? and(whereClause, eq(aiAuditLog.wasFiltered, true)) : eq(aiAuditLog.wasFiltered, true)
    ),
    // Average response time
    db.select({ avg: sql<number>`avg(response_time_ms)` }).from(aiAuditLog).where(whereClause),
    // By interface
    db.select({
      interface: aiAuditLog.interface,
      count: sql<number>`count(*)`,
    }).from(aiAuditLog).where(whereClause).groupBy(aiAuditLog.interface),
  ]);

  return {
    totalQueries: totalQueries[0]?.count || 0,
    piiDetected: piiDetected[0]?.count || 0,
    filtered: filtered[0]?.count || 0,
    avgResponseTime: Math.round(avgResponseTime[0]?.avg || 0),
    byInterface: byInterface as { interface: string; count: number }[],
  };
}

export async function getAIAuditLogDetailAction(logId: string) {
  await requireInternalRole();

  const log = await db.query.aiAuditLog.findFirst({
    where: eq(aiAuditLog.id, logId),
    with: {
      org: {
        columns: { name: true, subdomain: true },
      },
      user: {
        columns: { name: true, email: true, isInternal: true },
      },
    },
  });

  return log;
}
