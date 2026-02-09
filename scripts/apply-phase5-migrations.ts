#!/usr/bin/env tsx
/**
 * Apply Phase 5 Feature Migrations
 * 
 * This script applies the database migrations for Phase 5 features:
 * - CSAT (Customer Satisfaction) System
 * - Time Tracking
 * - Webhook System
 * - Scheduled Tickets
 * - Dashboard Widgets
 * - Bulk Operations
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import postgres from 'postgres';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('🚀 Applying Phase 5 Feature Migrations...\n');

  const sql = postgres(DATABASE_URL!);

  try {
    // Read and execute the migration file
    const migrationPath = resolve(process.cwd(), 'drizzle/0026_new_features_phase5.sql');
    const migration = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Executing migration file: 0026_new_features_phase5.sql');
    
    // Split and execute statements
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await sql.unsafe(statement + ';');
        process.stdout.write('.');
      } catch (error) {
        // Ignore "already exists" errors
        if (error instanceof Error && 
            (error.message.includes('already exists') || 
             error.message.includes('duplicate'))) {
          process.stdout.write('s');
        } else {
          throw error;
        }
      }
    }

    console.log('\n\n✅ Phase 5 migrations applied successfully!\n');
    console.log('📊 New features enabled:');
    console.log('   • CSAT (Customer Satisfaction) System');
    console.log('   • Time Tracking on Tickets');
    console.log('   • Webhook System for Integrations');
    console.log('   • Scheduled Tickets');
    console.log('   • Customizable Dashboard Widgets');
    console.log('   • Bulk Operations on Tickets');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
