-- Create kb_article_versions table
CREATE TABLE IF NOT EXISTS "kb_article_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "article_id" uuid NOT NULL REFERENCES "kb_articles"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "edited_by" uuid NOT NULL REFERENCES "users"("id"),
  "edited_at" timestamp DEFAULT now() NOT NULL,
  "change_description" text,
  UNIQUE ("article_id", "version")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_kb_versions_article" ON "kb_article_versions" ("article_id");
CREATE INDEX IF NOT EXISTS "idx_kb_versions_edited" ON "kb_article_versions" ("edited_at");
