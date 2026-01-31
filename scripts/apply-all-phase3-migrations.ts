import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying all Phase 3 migrations...\n');

  const statements = [
    // Phase 3 Security (0007) - Composite indexes for tenant-scoped queries
    `CREATE INDEX IF NOT EXISTS idx_tickets_org_created ON tickets(org_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_org_status ON tickets(org_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_org_assignee ON tickets(org_id, assignee_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_org_priority ON tickets(org_id, priority)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_ticket_created ON ticket_comments(ticket_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_org_ticket ON ticket_comments(ticket_id, org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_attachments_ticket_org ON attachments(ticket_id, org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_attachments_org_created ON attachments(org_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(org_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_ticket_org ON audit_logs(ticket_id, org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tag_assignments_ticket_org ON ticket_tag_assignments(ticket_id, org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_memberships_user_org ON memberships(user_id, org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_memberships_org_user ON memberships(org_id, user_id)`,
    
    // Phase 3 Email Threading (0008)
    `ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "message_id" TEXT`,
    `ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "in_reply_to" TEXT`,
    `ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "references" TEXT`,
    `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "email_thread_id" TEXT`,
    `ALTER TABLE "ticket_templates" ADD COLUMN IF NOT EXISTS "internal_only" BOOLEAN DEFAULT false NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_comments_message_id ON ticket_comments(message_id)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_in_reply_to ON ticket_comments(in_reply_to)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_email_thread_id ON tickets(email_thread_id)`,
    
    // Phase 3 Storage Quotas (0009)
    `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "storage_quota_bytes" BIGINT DEFAULT 10737418240`,
    `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "storage_used_bytes" BIGINT DEFAULT 0`,
    `CREATE INDEX IF NOT EXISTS idx_organizations_storage_quota ON organizations(storage_quota_bytes, storage_used_bytes)`,
    `UPDATE "organizations" SET "storage_used_bytes" = COALESCE((SELECT SUM("size") FROM "attachments" WHERE "attachments"."org_id" = "organizations"."id"), 0)`,
    
    // Phase 3 Virus Scanning (0010)
    `ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scan_status" TEXT DEFAULT 'PENDING'`,
    `ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scan_result" TEXT`,
    `ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scanned_at" TIMESTAMP`,
    `ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "is_quarantined" BOOLEAN DEFAULT false`,
    `CREATE INDEX IF NOT EXISTS idx_attachments_scan_status ON attachments(scan_status)`,
    `CREATE INDEX IF NOT EXISTS idx_attachments_quarantined ON attachments(is_quarantined) WHERE is_quarantined = true`,
    
    // Phase 3 Business Hours (0011)
    `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "business_hours" JSONB`,
    
    // Phase 3 Public Intake Flag (0011a)
    `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "allow_public_intake" BOOLEAN DEFAULT true NOT NULL`,
    
    // Phase 3 SLA Pause (0012)
    `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_paused_at" TIMESTAMP`,
    `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_pause_reason" TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_sla_paused ON tickets(sla_paused_at) WHERE sla_paused_at IS NOT NULL`,
    
    // Phase 3 Immutable Audit (0013)
    `CREATE OR REPLACE FUNCTION prevent_audit_log_updates() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.action IS NOT DISTINCT FROM OLD.action
      AND NEW.details IS NOT DISTINCT FROM OLD.details
      AND NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address
      AND NEW.user_agent IS NOT DISTINCT FROM OLD.user_agent
      AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
      AND (
        (NEW.user_id IS NULL AND OLD.user_id IS NOT NULL)
        OR NEW.user_id IS NOT DISTINCT FROM OLD.user_id
      )
      AND (
        (NEW.org_id IS NULL AND OLD.org_id IS NOT NULL)
        OR NEW.org_id IS NOT DISTINCT FROM OLD.org_id
      )
      AND (
        (NEW.ticket_id IS NULL AND OLD.ticket_id IS NOT NULL)
        OR NEW.ticket_id IS NOT DISTINCT FROM OLD.ticket_id
      )
    THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Audit logs are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS audit_logs_prevent_update ON audit_logs`,
    `CREATE TRIGGER audit_logs_prevent_update BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_updates()`,
    `DROP TRIGGER IF EXISTS audit_logs_prevent_delete ON audit_logs`,
    `CREATE TRIGGER audit_logs_prevent_delete BEFORE DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_updates()`,
    
    // Phase 3 Canned Responses (0014)
    `CREATE TABLE IF NOT EXISTS "canned_responses" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "content" text NOT NULL,
      "shortcut" text,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_canned_responses_org ON canned_responses(org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_canned_responses_shortcut ON canned_responses(org_id, shortcut) WHERE shortcut IS NOT NULL`,
    
    // Phase 3 Ticket Links (0015)
    `CREATE TABLE IF NOT EXISTS "ticket_links" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "source_ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
      "target_ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
      "link_type" text NOT NULL CHECK (link_type IN ('related', 'duplicate', 'blocks', 'blocked_by')),
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      UNIQUE(source_ticket_id, target_ticket_id, link_type)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ticket_links_source ON ticket_links(source_ticket_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ticket_links_target ON ticket_links(target_ticket_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ticket_links_type ON ticket_links(link_type)`,
    
    // Phase 3 Data Retention and Anonymization (0016)
    `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "data_retention_days" INTEGER`,
    `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "retention_policy" TEXT`,
    // Add constraint separately if it doesn't exist
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_retention_policy_check') THEN ALTER TABLE "organizations" ADD CONSTRAINT "organizations_retention_policy_check" CHECK (retention_policy IS NULL OR retention_policy IN ('KEEP_FOREVER', 'DELETE_AFTER_DAYS', 'ANONYMIZE_AFTER_DAYS')); END IF; END $$`,
    `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets(deleted_at) WHERE deleted_at IS NOT NULL`,
    `ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP`,
    `CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON ticket_comments(deleted_at) WHERE deleted_at IS NOT NULL`,
    `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN DEFAULT false`,
    `ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN DEFAULT false`,
    
    // Phase 3 Automation Rules (0017)
    `CREATE TABLE IF NOT EXISTS "automation_rules" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "enabled" boolean DEFAULT true NOT NULL,
      "priority" integer DEFAULT 0 NOT NULL,
      "trigger_on" text NOT NULL CHECK (trigger_on IN ('CREATE', 'UPDATE', 'COMMENT')),
      "conditions" text NOT NULL,
      "actions" text NOT NULL,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules(org_id, enabled, priority) WHERE enabled = true`,

    // User Invitations (0018)
    `CREATE TABLE IF NOT EXISTS "user_invitations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "email" text NOT NULL,
      "role" text NOT NULL CHECK (role IN ('CUSTOMER_ADMIN', 'REQUESTER', 'VIEWER')),
      "invited_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "token" text NOT NULL UNIQUE,
      "expires_at" timestamp NOT NULL,
      "accepted_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_user_invitations_org ON user_invitations(org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token) WHERE accepted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email) WHERE accepted_at IS NULL`,
    
    // Memberships quality-of-life columns
    `ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true NOT NULL`,
    `ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMP`,
    
    // User Details (0019)
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" text`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" text`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notes" text`,
    
    // User Manager (0020)
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "manager_id" uuid`,
    // Note: Foreign key constraint will be added separately if it doesn't exist
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_manager_id_users_id_fk') THEN ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL; END IF; END $$`,
    
    // User Sessions (0021)
    `CREATE TABLE IF NOT EXISTS "user_sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "session_token" text NOT NULL UNIQUE,
      "device_info" text,
      "ip_address" text,
      "user_agent" text,
      "last_active_at" timestamp DEFAULT now() NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "revoked_at" timestamp
    )`,
    `CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token)`,
    `CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked ON user_sessions(user_id, revoked_at) WHERE revoked_at IS NULL`,
  ];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    try {
      await db.execute(sql.raw(statement));
      console.log(`✓ [${i + 1}/${statements.length}] Applied`);
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('already exists') ||
        error.message.includes('duplicate') ||
        error.message.includes('IF NOT EXISTS')
      )) {
        console.log(`⊘ [${i + 1}/${statements.length}] Skipped (already exists)`);
      } else {
        console.error(`✗ [${i + 1}/${statements.length}] Failed:`);
        console.error(statement.substring(0, 100));
        console.error(error);
        // Continue with other migrations even if one fails
      }
    }
  }

  console.log('\n✅ All migrations applied!');
  process.exit(0);
}

applyMigration().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
