import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const sqlFile = join(process.cwd(), 'drizzle', '0008_phase3_email_threading.sql');

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const sql = postgres(connectionString);
  
  try {
    const migrationSQL = readFileSync(sqlFile, 'utf-8');
    const statements = migrationSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(`Applying ${statements.length} statements from ${sqlFile}...`);

    for (const statement of statements) {
      try {
        await sql.unsafe(statement);
        console.log('✓ Applied:', statement.substring(0, 50) + '...');
      } catch (error) {
        // Ignore "already exists" errors
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log('⊘ Skipped (already exists):', statement.substring(0, 50) + '...');
        } else {
          throw error;
        }
      }
    }

    console.log('Migration applied successfully!');
  } finally {
    await sql.end();
  }
}

applyMigration().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

