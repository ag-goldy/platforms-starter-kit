DO $$ BEGIN
 CREATE TYPE "ticket_token_purpose" AS ENUM ('VIEW', 'REPLY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "email_status" AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "allow_public_intake" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "org_id" uuid;
--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "blob_pathname" text;
--> statement-breakpoint
UPDATE "attachments" SET "org_id" = "tickets"."org_id"
FROM "tickets"
WHERE "attachments"."ticket_id" = "tickets"."id";
--> statement-breakpoint
UPDATE "attachments"
SET "blob_pathname" = regexp_replace("storage_key", '^https?://[^/]+/', '')
WHERE "blob_pathname" IS NULL;
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "org_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "blob_pathname" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DELETE FROM "ticket_tokens";
--> statement-breakpoint
ALTER TABLE "ticket_tokens" DROP CONSTRAINT "ticket_tokens_token_unique";
--> statement-breakpoint
ALTER TABLE "ticket_tokens" ADD COLUMN "token_hash" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "ticket_tokens" ADD COLUMN "purpose" "ticket_token_purpose" NOT NULL;
--> statement-breakpoint
ALTER TABLE "ticket_tokens" ADD COLUMN "last_sent_at" timestamp;
--> statement-breakpoint
ALTER TABLE "ticket_tokens" ADD COLUMN "created_ip" text;
--> statement-breakpoint
ALTER TABLE "ticket_tokens" ADD COLUMN "used_ip" text;
--> statement-breakpoint
ALTER TABLE "ticket_tokens" DROP COLUMN "token";
--> statement-breakpoint
ALTER TABLE "ticket_tokens" ADD CONSTRAINT "ticket_tokens_token_hash_unique" UNIQUE("token_hash");
--> statement-breakpoint
CREATE TABLE "email_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "to" text NOT NULL,
  "subject" text NOT NULL,
  "html" text NOT NULL,
  "text" text,
  "status" "email_status" DEFAULT 'PENDING' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
