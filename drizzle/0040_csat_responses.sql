-- Create csat_responses table
CREATE TABLE IF NOT EXISTS "csat_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "rating" integer NOT NULL CHECK ("rating" >= 1 AND "rating" <= 5),
  "comment" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("ticket_id", "user_id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_csat_org" ON "csat_responses" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_csat_ticket" ON "csat_responses" ("ticket_id");
CREATE INDEX IF NOT EXISTS "idx_csat_created" ON "csat_responses" ("created_at");

-- Add comment
COMMENT ON TABLE "csat_responses" IS 'Customer satisfaction survey responses';
