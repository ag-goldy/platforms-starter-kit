-- Add new audit action enum values
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TICKET_MERGED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action')) THEN
   ALTER TYPE "audit_action" ADD VALUE 'TICKET_MERGED';
 END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TICKET_TAG_ADDED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action')) THEN
   ALTER TYPE "audit_action" ADD VALUE 'TICKET_TAG_ADDED';
 END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TICKET_TAG_REMOVED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action')) THEN
   ALTER TYPE "audit_action" ADD VALUE 'TICKET_TAG_REMOVED';
 END IF;
END $$;
--> statement-breakpoint

-- Add merged_into_id column to tickets table
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "merged_into_id" uuid;
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_merged_into_id_tickets_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Create ticket_templates table
CREATE TABLE IF NOT EXISTS "ticket_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_templates" ADD CONSTRAINT "ticket_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Create ticket_tags table
CREATE TABLE IF NOT EXISTS "ticket_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL UNIQUE,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create ticket_tag_assignments table
CREATE TABLE IF NOT EXISTS "ticket_tag_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"assigned_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_tag_assignments" ADD CONSTRAINT "ticket_tag_assignments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_tag_assignments" ADD CONSTRAINT "ticket_tag_assignments_tag_id_ticket_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."ticket_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_tag_assignments" ADD CONSTRAINT "ticket_tag_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Create ticket_merges table
CREATE TABLE IF NOT EXISTS "ticket_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_ticket_id" uuid NOT NULL,
	"target_ticket_id" uuid NOT NULL,
	"merged_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_merges" ADD CONSTRAINT "ticket_merges_source_ticket_id_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_merges" ADD CONSTRAINT "ticket_merges_target_ticket_id_tickets_id_fk" FOREIGN KEY ("target_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ticket_merges" ADD CONSTRAINT "ticket_merges_merged_by_id_users_id_fk" FOREIGN KEY ("merged_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

