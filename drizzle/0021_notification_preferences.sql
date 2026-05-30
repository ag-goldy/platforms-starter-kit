-- Migration: Create notification_preferences table
-- Purpose: per-user and per-platform-admin notification delivery preferences

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "platform_admin_id" uuid REFERENCES "platform_admins"("id") ON DELETE CASCADE,

  "email_enabled" boolean DEFAULT true NOT NULL,
  "email_ticket_assigned" boolean DEFAULT true NOT NULL,
  "email_ticket_status_changed" boolean DEFAULT false NOT NULL,
  "email_comment_added" boolean DEFAULT true NOT NULL,
  "email_mention" boolean DEFAULT true NOT NULL,
  "email_sla_breach" boolean DEFAULT true NOT NULL,
  "email_digest_frequency" text DEFAULT 'daily' NOT NULL,

  "inapp_enabled" boolean DEFAULT true NOT NULL,
  "inapp_ticket_assigned" boolean DEFAULT true NOT NULL,
  "inapp_ticket_status_changed" boolean DEFAULT true NOT NULL,
  "inapp_comment_added" boolean DEFAULT true NOT NULL,
  "inapp_mention" boolean DEFAULT true NOT NULL,
  "inapp_sla_breach" boolean DEFAULT true NOT NULL,

  "push_enabled" boolean DEFAULT false NOT NULL,
  "push_ticket_assigned" boolean DEFAULT false NOT NULL,
  "push_ticket_status_changed" boolean DEFAULT false NOT NULL,
  "push_comment_added" boolean DEFAULT false NOT NULL,
  "push_mention" boolean DEFAULT false NOT NULL,
  "push_sla_breach" boolean DEFAULT false NOT NULL,

  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT "notification_preferences_one_owner"
    CHECK (
      ("user_id" IS NOT NULL AND "platform_admin_id" IS NULL)
      OR
      ("user_id" IS NULL AND "platform_admin_id" IS NOT NULL)
    ),

  CONSTRAINT "notification_preferences_email_digest_frequency_check"
    CHECK ("email_digest_frequency" IN ('off', 'daily', 'weekly'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_id_unique"
  ON "notification_preferences" ("user_id")
  WHERE "user_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_platform_admin_id_unique"
  ON "notification_preferences" ("platform_admin_id")
  WHERE "platform_admin_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_notification_preferences_email_digest_frequency"
  ON "notification_preferences" ("email_digest_frequency")
  WHERE "email_digest_frequency" != 'off';
