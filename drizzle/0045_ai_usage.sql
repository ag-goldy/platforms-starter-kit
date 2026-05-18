-- Create ai_usage table for tracking AI token usage and costs
CREATE TABLE IF NOT EXISTS "ai_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "interface" text NOT NULL, -- 'public', 'customer', 'admin'
  "model_used" text NOT NULL,
  "prompt_tokens" integer NOT NULL DEFAULT 0,
  "completion_tokens" integer NOT NULL DEFAULT 0,
  "total_tokens" integer NOT NULL DEFAULT 0,
  "estimated_cost" numeric(10,6) NOT NULL DEFAULT 0,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_ai_usage_org" ON "ai_usage" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_created" ON "ai_usage" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_org_created" ON "ai_usage" ("org_id", "created_at");

-- Add comment
COMMENT ON TABLE "ai_usage" IS 'Tracks AI token usage and estimated costs per organization';
