import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying immutable audit log migration...\n');

  const statements = [
    // Create function to prevent updates/deletes
    `CREATE OR REPLACE FUNCTION prevent_audit_log_updates()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;`,
    // Drop existing triggers if they exist
    `DROP TRIGGER IF EXISTS audit_logs_prevent_update ON audit_logs;`,
    `DROP TRIGGER IF EXISTS audit_logs_prevent_delete ON audit_logs;`,
    // Create update prevention trigger
    `CREATE TRIGGER audit_logs_prevent_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_updates();`,
    // Create delete prevention trigger
    `CREATE TRIGGER audit_logs_prevent_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_updates();`,
    // Add comment
    `COMMENT ON TABLE audit_logs IS 'Immutable audit log - records cannot be updated or deleted for compliance and security';`,
  ];

  for (const statement of statements) {
    try {
      await db.execute(sql.raw(statement));
      console.log(`✓ ${statement.substring(0, 60)}...`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`⊘ Skipped (already exists): ${statement.substring(0, 60)}...`);
      } else {
        console.error(`✗ Failed: ${statement}`);
        console.error(error);
        throw error;
      }
    }
  }

  console.log('\n✅ Migration applied successfully!');
  process.exit(0);
}

applyMigration().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
