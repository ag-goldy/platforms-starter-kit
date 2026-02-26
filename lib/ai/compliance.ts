/**
 * AI Compliance - GDPR & PDPA Compliance for AI Operations
 * 
 * Handles:
 * - Data processing records (GDPR Article 30)
 * - Right to erasure (GDPR Article 17 / PDPA)
 * - Data subject access requests (GDPR Article 15)
 * - Audit log retention policies
 */

import { db } from '@/db';
import { aiAuditLog, orgAIMemory } from '@/db/schema';
import { eq, lt } from 'drizzle-orm';

export interface AIDataProcessingRecord {
  purpose: string;
  legalBasis: string;
  dataCategories: string[];
  dataSubjects: string[];
  retention: string;
  thirdPartyProcessors: string[];
  safeguards: string[];
}

// Processing records for each AI interface
export const AI_PROCESSING_RECORDS: Record<string, AIDataProcessingRecord> = {
  public: {
    purpose: 'Provide automated support responses using public knowledge base',
    legalBasis: 'legitimate_interest',
    dataCategories: ['support_queries', 'public_kb_content'],
    dataSubjects: ['anonymous_visitors'],
    retention: '90_days',
    thirdPartyProcessors: ['openai'],
    safeguards: ['pii_filtering', 'no_personal_data_in_context', 'audit_logging'],
  },
  customer: {
    purpose: 'Provide organization-specific support using scoped data',
    legalBasis: 'contract',
    dataCategories: ['support_queries', 'org_kb_content', 'ticket_summaries', 'service_status'],
    dataSubjects: ['authenticated_customers'],
    retention: '1_year',
    thirdPartyProcessors: ['openai'],
    safeguards: ['tenant_isolation', 'pii_filtering', 'access_control', 'audit_logging', 'encryption'],
  },
  admin: {
    purpose: 'Assist internal agents with support operations',
    legalBasis: 'legitimate_interest',
    dataCategories: ['support_queries', 'full_ticket_data', 'user_data', 'org_data'],
    dataSubjects: ['internal_agents', 'administrators'],
    retention: '2_years',
    thirdPartyProcessors: ['openai'],
    safeguards: ['role_based_access', 'pii_flagging', 'full_audit_trail', '2fa_recommended'],
  },
};

/**
 * Handle user data deletion request (GDPR Article 17 / PDPA)
 */
export async function handleAIDataDeletionRequest(userId: string, orgId?: string): Promise<{
  success: boolean;
  deleted: number;
}> {
  // 1. Delete all entries in ai_audit_log where userId matches
  const deleted = await db.delete(aiAuditLog)
    .where(eq(aiAuditLog.userId, userId));

  // 2. Remove user references from org_ai_memory
  await db.delete(orgAIMemory)
    .where(eq(orgAIMemory.addedBy, userId));

  // 3. Log the deletion request in system compliance log
  console.log('[Compliance] AI data deletion for user:', userId, 'org:', orgId);

  return { success: true, deleted: deleted.length || 0 };
}

/**
 * Handle organization AI data deletion
 */
export async function handleOrgAIDataDeletion(orgId: string): Promise<{
  success: boolean;
  deleted: number;
}> {
  // 1. Delete all ai_audit_log entries for this orgId
  const deleted = await db.delete(aiAuditLog)
    .where(eq(aiAuditLog.orgId, orgId));

  // 2. Delete all org_ai_memory for this orgId
  await db.delete(orgAIMemory)
    .where(eq(orgAIMemory.orgId, orgId));

  // 3. Log the deletion
  console.log('[Compliance] AI data deletion for org:', orgId);

  return { success: true, deleted: deleted.length || 0 };
}

/**
 * Generate data export for subject access request (GDPR Article 15)
 */
export async function generateAIDataExport(userId: string): Promise<{
  queries: unknown[];
  memories: unknown[];
  processingRecord: AIDataProcessingRecord;
}> {
  // Get all AI queries made by this user
  const queries = await db.query.aiAuditLog.findMany({
    where: eq(aiAuditLog.userId, userId),
    orderBy: (log) => log.createdAt,
  });

  // Get AI memories they contributed
  const memories = await db.query.orgAIMemory.findMany({
    where: eq(orgAIMemory.addedBy, userId),
  });

  return {
    queries,
    memories,
    processingRecord: AI_PROCESSING_RECORDS.customer,
  };
}

/**
 * Cleanup old AI audit logs based on retention policy
 * Run this weekly via cron job
 */
export async function cleanupAIAuditLogs(): Promise<{
  publicDeleted: number;
  customerDeleted: number;
  adminDeleted: number;
}> {
  const now = new Date();
  
  // Public: 90 days
  const publicCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const publicDeleted = await db.delete(aiAuditLog)
    .where(
      and(
        eq(aiAuditLog.interface, 'public'),
        lt(aiAuditLog.createdAt, publicCutoff)
      )
    );

  // Customer: 1 year
  const customerCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const customerDeleted = await db.delete(aiAuditLog)
    .where(
      and(
        eq(aiAuditLog.interface, 'customer'),
        lt(aiAuditLog.createdAt, customerCutoff)
      )
    );

  // Admin: 2 years
  const adminCutoff = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
  const adminDeleted = await db.delete(aiAuditLog)
    .where(
      and(
        eq(aiAuditLog.interface, 'admin'),
        lt(aiAuditLog.createdAt, adminCutoff)
      )
    );

  console.log('[Compliance] AI audit log cleanup:', {
    public: publicDeleted.length || 0,
    customer: customerDeleted.length || 0,
    admin: adminDeleted.length || 0,
  });

  return {
    publicDeleted: publicDeleted.length || 0,
    customerDeleted: customerDeleted.length || 0,
    adminDeleted: adminDeleted.length || 0,
  };
}

// Helper for the delete queries
function and(...conditions: any[]) {
  return conditions.reduce((acc, curr) => acc && curr, true);
}
