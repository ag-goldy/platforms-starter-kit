-- Add email-to-ticket settings columns to organizations table
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "intake_email_address" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "auto_reply_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "auto_reply_template" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "email_domain" text;

-- Add comment explaining usage
COMMENT ON COLUMN "organizations"."intake_email_address" IS 'Dedicated email address for ticket intake (e.g., support@hotel.com)';
COMMENT ON COLUMN "organizations"."auto_reply_enabled" IS 'Whether to send auto-reply confirmation emails';
COMMENT ON COLUMN "organizations"."auto_reply_template" IS 'Custom template for auto-reply emails';
COMMENT ON COLUMN "organizations"."email_domain" IS 'Email domain for auto-matching tickets to this org';
