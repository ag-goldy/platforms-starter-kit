#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';
import postgres from 'postgres';

config({ path: resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('Applying Global KB Categories Migration...\n');
  
  const sql = postgres(DATABASE_URL!, { max: 1 });
  
  try {
    // Make orgId nullable for kb_categories
    await sql`ALTER TABLE kb_categories ALTER COLUMN org_id DROP NOT NULL`;
    console.log('✓ kb_categories.org_id is now nullable');
    
    // Drop old unique constraint if exists
    await sql`DROP INDEX IF EXISTS kb_categories_org_id_slug_unique`;
    console.log('✓ Dropped old unique index');
    
    // Create new unique indexes
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS kb_categories_global_slug_unique ON kb_categories (slug) WHERE org_id IS NULL`;
    console.log('✓ Created global slug unique index');
    
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS kb_categories_org_slug_unique ON kb_categories (org_id, slug) WHERE org_id IS NOT NULL`;
    console.log('✓ Created org-specific slug unique index');
    
    // Make orgId nullable for kb_articles
    await sql`ALTER TABLE kb_articles ALTER COLUMN org_id DROP NOT NULL`;
    console.log('✓ kb_articles.org_id is now nullable');
    
    // Drop old unique constraint if exists
    await sql`DROP INDEX IF EXISTS kb_articles_org_slug_unique`;
    console.log('✓ Dropped old article unique index');
    
    // Create new unique indexes for articles
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS kb_articles_global_slug_unique ON kb_articles (slug) WHERE org_id IS NULL`;
    console.log('✓ Created global article slug unique index');
    
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS kb_articles_org_slug_unique ON kb_articles (org_id, slug) WHERE org_id IS NOT NULL`;
    console.log('✓ Created org-specific article slug unique index');
    
    console.log('\n✅ Migration applied successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
