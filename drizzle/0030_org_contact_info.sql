-- Migration: Add org_contact_info table for tenant-scoped support contact details
-- Purpose: Enable Fortinet-style email templates with per-tenant phone/email/URL

CREATE TABLE "org_contact_info" (
  "org_id" uuid PRIMARY KEY REFERENCES "organizations"("id") ON DELETE CASCADE,
  "support_phone" text,
  "support_email" text,
  "support_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER "update_org_contact_info_updated_at"
  BEFORE UPDATE ON "org_contact_info"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
