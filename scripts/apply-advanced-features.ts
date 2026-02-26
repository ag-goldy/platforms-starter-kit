import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 });
  
  try {
    const migrationPath = path.join(process.cwd(), 'drizzle', '027_advanced_features.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('Applying advanced features migration...');
    
    // Split and execute statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
    
    for (const statement of statements) {
      try {
        await sql.unsafe(statement + ';');
        console.log('✓ Executed statement');
      } catch (err) {
        // Ignore "already exists" errors
        const error = err as Error;
        if (error.message?.includes('already exists')) {
          console.log('  (skipped - already exists)');
        } else {
          console.error('  Error:', error.message);
        }
      }
    }
    
    console.log('\n✅ Advanced features migration completed!');
    
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
