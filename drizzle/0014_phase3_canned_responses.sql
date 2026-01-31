-- Phase 3.10.2: Canned Responses
-- Create canned_responses table

CREATE TABLE IF NOT EXISTS "canned_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "content" text NOT NULL,
  "shortcut" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canned_responses_org ON canned_responses(org_id);
CREATE INDEX IF NOT EXISTS idx_canned_responses_shortcut ON canned_responses(org_id, shortcut) WHERE shortcut IS NOT NULL;

