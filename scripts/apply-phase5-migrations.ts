/**
 * Migration script for Phase 5 changes:
 * - Password reset tokens table
 * - SLA policy fields on organizations
 * 
 * Run with: pnpm tsx scripts/apply-phase5-migrations.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import postgres from 'postgres';

config({ path: resolve(process.cwd(), '.env.local') });

const sql = postgres(process.env.DATABASE_URL!);

async function applyMigrations() {
    console.log('Applying Phase 5 migrations...');

    try {
        // Add SLA policy columns to organizations
        console.log('Adding SLA policy columns to organizations...');
        await sql`
      ALTER TABLE organizations 
      ADD COLUMN IF NOT EXISTS sla_response_hours_p1 INTEGER,
      ADD COLUMN IF NOT EXISTS sla_response_hours_p2 INTEGER,
      ADD COLUMN IF NOT EXISTS sla_response_hours_p3 INTEGER,
      ADD COLUMN IF NOT EXISTS sla_response_hours_p4 INTEGER,
      ADD COLUMN IF NOT EXISTS sla_resolution_hours_p1 INTEGER,
      ADD COLUMN IF NOT EXISTS sla_resolution_hours_p2 INTEGER,
      ADD COLUMN IF NOT EXISTS sla_resolution_hours_p3 INTEGER,
      ADD COLUMN IF NOT EXISTS sla_resolution_hours_p4 INTEGER
    `;
        console.log('✓ SLA policy columns added');

        // Create password reset tokens table
        console.log('Creating password_reset_tokens table...');
        await sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
        console.log('✓ password_reset_tokens table created');

        // Create index for faster lookups
        await sql`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id 
      ON password_reset_tokens(user_id)
    `;
        console.log('✓ Index created');

        console.log('\n✅ All Phase 5 migrations applied successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await sql.end();
    }
}

applyMigrations();
