import { readFileSync } from 'fs';
import { resolve } from 'path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

// Load .env.local for migration script
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set. Make sure .env.local exists and contains DATABASE_URL.');
  }

  const sql = postgres(databaseUrl);
  const migrationPath = resolve(process.cwd(), 'drizzle/0004_sla_tracking.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  // Split by statement breakpoints and execute each statement
  const statements = migrationSQL
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // If no statement breakpoints, treat the whole file as one statement
  const finalStatements = statements.length > 0 ? statements : [migrationSQL.trim()].filter(s => s.length > 0);

  console.log(`Applying ${finalStatements.length} migration statements...`);

  for (let i = 0; i < finalStatements.length; i++) {
    const statement = finalStatements[i];
    try {
      await sql.unsafe(statement);
      console.log(`✓ Statement ${i + 1}/${finalStatements.length} applied`);
    } catch (error) {
      console.error(`✗ Error in statement ${i + 1}:`, error);
      throw error;
    }
  }

  await sql.end();
  console.log('Migration applied successfully!');
}

applyMigration().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
