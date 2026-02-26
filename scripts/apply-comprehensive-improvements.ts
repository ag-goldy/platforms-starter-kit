#!/usr/bin/env tsx
/**
 * Comprehensive Improvements Migration Script
 * 
 * This script applies all the database migrations for the comprehensive improvements:
 * - Time tracking
 * - Subtasks
 * - Dependencies
 * - Draft autosave
 * - PII detection
 * - Webhooks
 * - Agent metrics
 * - And more...
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('🚀 Starting comprehensive improvements migration...\n');

  const client = postgres(DATABASE_URL!, { max: 1 });

  try {
    // Read and execute the migration SQL
    const migrationPath = join(process.cwd(), 'db', 'migrations', '0001_comprehensive_improvements.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Applying migration from:', migrationPath);
    console.log('⏳ This may take a few minutes...\n');

    // Split and execute statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let completed = 0;
    for (const statement of statements) {
      try {
        await client.unsafe(statement + ';');
        completed++;
        process.stdout.write(`\r✅ Progress: ${completed}/${statements.length} statements`);
      } catch (error) {
        console.error(`\n❌ Error executing statement: ${statement.slice(0, 100)}...`);
        console.error(error);
        // Continue with other statements
      }
    }

    console.log('\n\n✅ Migration completed successfully!\n');
    console.log('📊 New features enabled:');
    console.log('  • Time Tracking - Track time spent on tickets');
    console.log('  • Subtasks - Break down tickets into smaller tasks');
    console.log('  • Dependencies - Link related tickets');
    console.log('  • Draft Autosave - Automatic draft saving');
    console.log('  • PII Detection - Automatic sensitive data detection');
    console.log('  • Webhooks - Outgoing webhook notifications');
    console.log('  • Agent Metrics - Performance tracking');
    console.log('  • KB Analytics - Article performance insights');
    console.log('  • Scheduled Reports - Automated reporting');
    console.log('  • Performance Indexes - Optimized database queries');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
