/**
 * Migration Verification Script
 *
 * Checks that all required tables exist in the database.
 * Run with: npx tsx scripts/verify-migrations.ts
 */

import { db } from "../db";

const REQUIRED_TABLES = [
  // Core tables
  "organizations",
  "users",
  "memberships",
  "tickets",
  "ticket_comments",
  "ticket_attachments",
  "attachments",
  "services",
  "sites",
  "site_areas",
  "areas",
  "assets",
  "asset_types",
  "asset_statuses",

  // Phase 3 additions
  "time_entries",
  "ticket_subtasks",
  "ticket_dependencies",
  "ticket_drafts",
  "ticket_edit_sessions",
  "pii_detection_rules",
  "kb_article_analytics",
  "webhook_subscriptions",
  "org_ai_configs",
  "org_ai_memory",
  "ai_audit_log",

  // Statuspage integration
  "statuspage_configs",

  // Zabbix
  "zabbix_configs",
  "service_monitoring_history",

  // Other
  "request_types",
  "kb_articles",
  "kb_categories",
  "internal_groups",
  "internal_group_memberships",
  "audit_logs",
  "sessions",
  "notification_preferences",
  "email_outbox",
  "failed_jobs",
  "exports",
  "export_requests",
  "automation_rules",
  "escalation_rules",
  "assignment_rules",
];

async function verifyMigrations() {
  console.log("🔍 Verifying database migrations...\n");

  try {
    // Test connection
    await db.execute("SELECT 1");
    console.log("✅ Database connection successful\n");

    // Get all tables
    const result = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    const existingTables = new Set(
      result.map((r: { table_name: string }) => r.table_name),
    );

    const missing: string[] = [];
    const found: string[] = [];

    for (const table of REQUIRED_TABLES) {
      if (existingTables.has(table)) {
        found.push(table);
      } else {
        missing.push(table);
      }
    }

    console.log(
      `✅ Found ${found.length}/${REQUIRED_TABLES.length} required tables:\n`,
    );

    if (missing.length > 0) {
      console.log(`❌ Missing ${missing.length} tables:\n`);
      for (const table of missing) {
        console.log(`   - ${table}`);
      }
      console.log("\n⚠️  Run missing migrations with: pnpm db:migrate");
      process.exit(1);
    } else {
      console.log("\n✅ All required tables exist!");

      // Check indexes
      console.log("\n🔍 Checking performance indexes...");
      const indexResult = await db.execute(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%'
      `);
      console.log(`   Found ${indexResult.length} custom indexes`);

      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

verifyMigrations();
