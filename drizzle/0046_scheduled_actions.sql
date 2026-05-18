-- Create scheduled_ticket_actions table
CREATE TABLE IF NOT EXISTS "scheduled_ticket_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "action" text NOT NULL, -- 'send_followup', 'escalate', 'auto_close'
  "scheduled_for" timestamp NOT NULL,
  "executed" boolean DEFAULT false NOT NULL,
  "executed_at" timestamp,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_scheduled_actions_org" ON "scheduled_ticket_actions" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_actions_ticket" ON "scheduled_ticket_actions" ("ticket_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_actions_pending" ON "scheduled_ticket_actions" ("org_id", "executed", "scheduled_for") WHERE "executed" = false;
