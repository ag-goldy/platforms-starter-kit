-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "email_enabled" boolean DEFAULT true NOT NULL,
  "in_app_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("user_id", "event_type")
);

-- Create index
CREATE INDEX IF NOT EXISTS "idx_notification_preferences_user" ON "notification_preferences" ("user_id");

-- Add comment
COMMENT ON TABLE "notification_preferences" IS 'Per-user notification preferences by event type';
