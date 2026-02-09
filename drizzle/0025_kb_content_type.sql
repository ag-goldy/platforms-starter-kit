-- Add content_type column to kb_articles
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'markdown' NOT NULL;

-- Create index for content type filtering
CREATE INDEX IF NOT EXISTS idx_kb_articles_content_type ON kb_articles(content_type);
