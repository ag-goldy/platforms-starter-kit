-- Migration: Add platform_admin_id to notifications for admin recipient support
-- Purpose: enable platform admin notifications alongside user notifications

ALTER TABLE "notifications" ADD COLUMN "platform_admin_id" uuid
  REFERENCES "platform_admins"("id") ON DELETE CASCADE;

ALTER TABLE "notifications" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_one_recipient"
  CHECK (
    ("user_id" IS NOT NULL AND "platform_admin_id" IS NULL)
    OR
    ("user_id" IS NULL AND "platform_admin_id" IS NOT NULL)
  );

CREATE INDEX "idx_notifications_platform_admin_id"
  ON "notifications" ("platform_admin_id")
  WHERE "platform_admin_id" IS NOT NULL;

CREATE INDEX "idx_notifications_platform_admin_read"
  ON "notifications" ("platform_admin_id", "read")
  WHERE "platform_admin_id" IS NOT NULL AND "read" = false;
