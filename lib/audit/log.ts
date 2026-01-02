import { db } from '@/db';
import { auditActionEnum, auditLogs } from '@/db/schema';

export type AuditAction = (typeof auditActionEnum.enumValues)[number];

export interface AuditLogData {
  userId?: string;
  orgId?: string;
  ticketId?: string;
  action: AuditAction;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(data: AuditLogData) {
  await db.insert(auditLogs).values({
    userId: data.userId,
    orgId: data.orgId,
    ticketId: data.ticketId,
    action: data.action,
    details: data.details,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });
}
