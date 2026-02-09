-- Make orgId nullable for global KB categories
ALTER TABLE kb_categories ALTER COLUMN org_id DROP NOT NULL;

-- Update unique constraint to handle null orgId
ALTER TABLE kb_categories DROP CONSTRAINT IF EXISTS kb_categories_org_id_slug_unique;
CREATE UNIQUE INDEX kb_categories_global_slug_unique ON kb_categories (slug) WHERE org_id IS NULL;
CREATE UNIQUE INDEX kb_categories_org_slug_unique ON kb_categories (org_id, slug) WHERE org_id IS NOT NULL;

-- Also update kb_articles to allow global articles
ALTER TABLE kb_articles ALTER COLUMN org_id DROP NOT NULL;

-- Update indexes
DROP INDEX IF EXISTS kb_articles_org_slug_unique;
CREATE UNIQUE INDEX kb_articles_global_slug_unique ON kb_articles (slug) WHERE org_id IS NULL;
CREATE UNIQUE INDEX kb_articles_org_slug_unique ON kb_articles (org_id, slug) WHERE org_id IS NOT NULL;
