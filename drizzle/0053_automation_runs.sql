CREATE TABLE IF NOT EXISTS "automation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "rule_id" uuid NOT NULL REFERENCES "automation_rules"("id") ON DELETE cascade,
  "ticket_id" uuid REFERENCES "tickets"("id") ON DELETE set null,
  "trigger" "automation_trigger" NOT NULL,
  "matched" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'SUCCESS' NOT NULL,
  "actions_executed" integer DEFAULT 0 NOT NULL,
  "duration_ms" integer DEFAULT 0 NOT NULL,
  "error" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "ai_audit_log"
  ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;
