/**
 * AI Audit Logging
 * Records every AI interaction for compliance and security monitoring
 */

import { db } from '@/db';
import { aiAuditLog } from '@/db/schema';

interface AIInteractionLog {
  orgId: string | null;
  userId: string | null;
  interface: 'public' | 'customer' | 'admin';
  userQuery: string;
  systemPromptHash: string;
  aiResponse: string;
  modelUsed?: string;
  tokensUsed?: number;
  responseTimeMs?: number;
  piiDetected: boolean;
  piiTypes?: string[];
  wasFiltered: boolean;
  sourcesUsed?: string[];
  ipAddress: string | null;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an AI interaction to the audit table
 * This should be called for EVERY AI request/response
 */
export async function logAIInteraction(log: AIInteractionLog): Promise<void> {
  try {
    await db.insert(aiAuditLog).values({
      orgId: log.orgId,
      userId: log.userId,
      interface: log.interface,
      userQuery: log.userQuery.slice(0, 4000), // Truncate to prevent DB issues
      systemPromptHash: log.systemPromptHash,
      aiResponse: log.aiResponse.slice(0, 8000), // Truncate long responses
      modelUsed: log.modelUsed || 'deepseek-ai/DeepSeek-V3.1',
      tokensUsed: log.tokensUsed,
      responseTimeMs: log.responseTimeMs,
      piiDetected: log.piiDetected,
      piiTypes: log.piiTypes || [],
      wasFiltered: log.wasFiltered,
      sourcesUsed: log.sourcesUsed || [],
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata || {},
    });

  } catch (error) {
    // Log to console but don't fail the AI response
    console.error('[AI Audit] Failed to log interaction:', error);
  }
}

/**
 * Query audit logs with filters
 * Used by the admin audit dashboard
 */
export async function queryAuditLogs(filters: {
  orgId?: string;
  userId?: string;
  interface?: 'public' | 'customer' | 'admin';
  startDate?: Date;
  endDate?: Date;
  piiDetected?: boolean;
  wasFiltered?: boolean;
  limit?: number;
  offset?: number;
}) {
  const { orgId, userId, interface: iface, startDate, endDate, piiDetected, wasFiltered, limit = 50, offset = 0 } = filters;

  // Build dynamic query
  const query = db.query.aiAuditLog.findMany({
    limit,
    offset,
    orderBy: (logs, { desc }) => [desc(logs.createdAt)],
  });

  // Apply filters (this is simplified - in production use proper Drizzle filtering)
  // For now, return all and filter in memory (for small datasets)
  const allLogs = await query;
  
  let filtered = allLogs;
  
  if (orgId) {
    filtered = filtered.filter(l => l.orgId === orgId);
  }
  if (userId) {
    filtered = filtered.filter(l => l.userId === userId);
  }
  if (iface) {
    filtered = filtered.filter(l => l.interface === iface);
  }
  if (piiDetected !== undefined) {
    filtered = filtered.filter(l => l.piiDetected === piiDetected);
  }
  if (wasFiltered !== undefined) {
    filtered = filtered.filter(l => l.wasFiltered === wasFiltered);
  }
  if (startDate) {
    filtered = filtered.filter(l => new Date(l.createdAt) >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter(l => new Date(l.createdAt) <= endDate);
  }

  return filtered;
}

/**
 * Get audit stats for the admin dashboard
 */
export async function getAuditStats(timeRange: 'today' | 'week' | 'month' = 'today') {
  const now = new Date();
  const startDate = new Date();
  
  switch (timeRange) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
  }

  const allLogs = await db.query.aiAuditLog.findMany({
    where: (logs, { gte }) => gte(logs.createdAt, startDate),
  });

  const stats = {
    totalQueries: allLogs.length,
    piiDetected: allLogs.filter(l => l.piiDetected).length,
    wasFiltered: allLogs.filter(l => l.wasFiltered).length,
    byInterface: {
      public: allLogs.filter(l => l.interface === 'public').length,
      customer: allLogs.filter(l => l.interface === 'customer').length,
      admin: allLogs.filter(l => l.interface === 'admin').length,
    },
    avgResponseTime: allLogs.length > 0
      ? allLogs.reduce((sum, l) => sum + (l.responseTimeMs || 0), 0) / allLogs.length
      : 0,
  };

  return stats;
}

/**
 * Clean up old audit logs based on retention policy
 * Run this as a scheduled job
 */
export async function cleanupOldAuditLogs(): Promise<void> {
  const now = new Date();
  
  // Public: 90 days retention
  const publicCutoff = new Date(now);
  publicCutoff.setDate(now.getDate() - 90);
  
  // Customer: 1 year retention
  const customerCutoff = new Date(now);
  customerCutoff.setFullYear(now.getFullYear() - 1);
  
  // Admin: 2 years retention
  const adminCutoff = new Date(now);
  adminCutoff.setFullYear(now.getFullYear() - 2);

  // In production, use proper DELETE queries with WHERE clauses
}
