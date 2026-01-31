/**
 * Apply Phase 4.0 database migrations
 * 
 * Adds 2FA columns and other Phase 4.0 schema changes
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

async function applyMigrations() {
  console.log('Applying Phase 4.0 migrations...\n');

  const migrations = [
    // Phase 4.0: Failed jobs table for dead-letter queue
    {
      name: 'Create failed_jobs table',
      sql: `
        CREATE TABLE IF NOT EXISTS "failed_jobs" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "job_id" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "data" JSONB NOT NULL,
          "error" TEXT NOT NULL,
          "attempts" INTEGER NOT NULL,
          "max_attempts" INTEGER NOT NULL,
          "failed_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "retried_at" TIMESTAMP,
          "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `,
    },
    {
      name: 'Create index on failed_jobs type',
      sql: `
        CREATE INDEX IF NOT EXISTS "idx_failed_jobs_type" ON "failed_jobs"("type")
      `,
    },
    {
      name: 'Create index on failed_jobs failed_at',
      sql: `
        CREATE INDEX IF NOT EXISTS "idx_failed_jobs_failed_at" ON "failed_jobs"("failed_at")
      `,
    },
    
    // Phase 4.0: 2FA columns for users
    {
      name: 'Add 2FA columns to users table',
      sql: `
        ALTER TABLE "users" 
        ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN DEFAULT false NOT NULL,
        ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT,
        ADD COLUMN IF NOT EXISTS "two_factor_backup_codes" TEXT
      `,
    },
    
    // Phase 4.0: 2FA policy for organizations
    {
      name: 'Add 2FA policy to organizations table',
      sql: `
        ALTER TABLE "organizations" 
        ADD COLUMN IF NOT EXISTS "require_two_factor" BOOLEAN DEFAULT false NOT NULL
      `,
    },
    
    // Phase 4.0: Add 2FA audit actions to enum
    // Note: PostgreSQL doesn't support IF NOT EXISTS for enum values
    // We'll try to add them and catch duplicate_object errors
    {
      name: 'Add USER_2FA_ENABLED to audit_action enum',
      sql: `
        DO $$ 
        BEGIN
          ALTER TYPE "audit_action" ADD VALUE 'USER_2FA_ENABLED';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `,
    },
    {
      name: 'Add USER_2FA_DISABLED to audit_action enum',
      sql: `
        DO $$ 
        BEGIN
          ALTER TYPE "audit_action" ADD VALUE 'USER_2FA_DISABLED';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `,
    },
    {
      name: 'Add USER_2FA_BACKUP_CODES_REGENERATED to audit_action enum',
      sql: `
        DO $$ 
        BEGIN
          ALTER TYPE "audit_action" ADD VALUE 'USER_2FA_BACKUP_CODES_REGENERATED';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `,
    },
    {
      name: 'Add cc_emails column to tickets table',
      sql: `
        ALTER TABLE "tickets"
        ADD COLUMN IF NOT EXISTS "cc_emails" JSONB
      `,
    },
  ];

  let applied = 0;
  let failed = 0;

  for (const migration of migrations) {
    try {
      await db.execute(sql.raw(migration.sql));
      applied++;
      console.log(`✓ [${applied}/${migrations.length}] ${migration.name}`);
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string };
      // Check if it's a "already exists" error
      if (e?.code === '42701' || e?.code === '42P07' || e?.message?.includes('already exists')) {
        applied++;
        console.log(`✓ [${applied}/${migrations.length}] ${migration.name} (already exists)`);
      } else {
        failed++;
        console.error(`✗ [${applied + failed}/${migrations.length}] ${migration.name}`);
        console.error(`  Error: ${e.message}`);
      }
    }
  }

  console.log(`\n✅ Migrations applied: ${applied} successful, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All Phase 4.0 migrations applied successfully!');
  } else {
    console.log(`⚠️  ${failed} migration(s) failed. Please review the errors above.`);
  }
}

applyMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
