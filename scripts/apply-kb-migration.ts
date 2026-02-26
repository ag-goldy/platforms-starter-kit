import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 });
  
  try {
    console.log('Applying KB migration...');
    
    // Add new columns for customer KB features
    await sql`ALTER TABLE "kb_articles" ADD COLUMN IF NOT EXISTS "is_anonymous" boolean DEFAULT false`;
    console.log('✓ Added is_anonymous column');
    
    await sql`ALTER TABLE "kb_articles" ADD COLUMN IF NOT EXISTS "submitted_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL`;
    console.log('✓ Added submitted_by_id column');
    
    await sql`ALTER TABLE "kb_articles" ADD COLUMN IF NOT EXISTS "approved_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL`;
    console.log('✓ Added approved_by_id column');
    
    await sql`ALTER TABLE "kb_articles" ADD COLUMN IF NOT EXISTS "approved_at" timestamp`;
    console.log('✓ Added approved_at column');
    
    await sql`ALTER TABLE "kb_articles" ADD COLUMN IF NOT EXISTS "rejection_reason" text`;
    console.log('✓ Added rejection_reason column');
    
    console.log('\n✅ KB migration applied successfully!');
    
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
