import dotenv from 'dotenv';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

async function createKBTables() {
  console.log('Creating Knowledge Base tables...\n');

  // Create kb_categories table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kb_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name text NOT NULL,
        slug text NOT NULL,
        description text,
        parent_id uuid REFERENCES kb_categories(id) ON DELETE SET NULL,
        sort_order integer DEFAULT 0 NOT NULL,
        is_public boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL,
        UNIQUE(org_id, slug)
      );
    `);
    console.log('✅ kb_categories table created');
  } catch (error) {
    console.error('❌ Failed to create kb_categories:', error);
  }

  // Create kb_articles table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kb_articles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        category_id uuid REFERENCES kb_categories(id) ON DELETE SET NULL,
        title text NOT NULL,
        slug text NOT NULL,
        content text NOT NULL,
        excerpt text,
        status text DEFAULT 'draft' NOT NULL,
        visibility text DEFAULT 'public' NOT NULL,
        author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        published_at timestamp,
        view_count integer DEFAULT 0 NOT NULL,
        helpful_count integer DEFAULT 0 NOT NULL,
        not_helpful_count integer DEFAULT 0 NOT NULL,
        tags jsonb DEFAULT '[]'::jsonb,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL,
        UNIQUE(org_id, slug)
      );
    `);
    console.log('✅ kb_articles table created');
  } catch (error) {
    console.error('❌ Failed to create kb_articles:', error);
  }

  // Create kb_article_feedback table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kb_article_feedback (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        article_id uuid NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        is_helpful boolean NOT NULL,
        comment text,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ kb_article_feedback table created');
  } catch (error) {
    console.error('❌ Failed to create kb_article_feedback:', error);
  }

  // Create indexes
  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kb_categories_org ON kb_categories(org_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kb_categories_parent ON kb_categories(parent_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kb_articles_org ON kb_articles(org_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kb_articles_visibility ON kb_articles(visibility);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kb_feedback_article ON kb_article_feedback(article_id);`);
    console.log('✅ KB indexes created');
  } catch (error) {
    console.error('❌ Failed to create indexes:', error);
  }

  console.log('\n✨ Knowledge Base tables created!');
}

createKBTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
