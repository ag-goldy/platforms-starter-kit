ALTER TYPE "public"."audit_action" ADD VALUE 'ORG_DISABLED' BEFORE 'EXPORT_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'ORG_ENABLED' BEFORE 'EXPORT_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'ORG_DELETED' BEFORE 'EXPORT_REQUESTED';--> statement-breakpoint
CREATE TABLE "ai_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid,
	"interface" text NOT NULL,
	"user_query" text NOT NULL,
	"system_prompt_hash" text NOT NULL,
	"ai_response" text NOT NULL,
	"model_used" text,
	"tokens_used" integer,
	"response_time_ms" integer,
	"pii_detected" boolean DEFAULT false,
	"pii_types" jsonb,
	"was_filtered" boolean DEFAULT false,
	"sources_used" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_ai_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"customer_ai_enabled" boolean DEFAULT true NOT NULL,
	"system_instructions" text,
	"allow_kb_access" boolean DEFAULT true NOT NULL,
	"allow_ticket_summaries" boolean DEFAULT false NOT NULL,
	"allow_asset_info" boolean DEFAULT false NOT NULL,
	"allow_service_status" boolean DEFAULT true NOT NULL,
	"block_pii_in_responses" boolean DEFAULT true NOT NULL,
	"max_response_tokens" integer DEFAULT 1000,
	"customer_rate_limit" integer DEFAULT 50,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_ai_configs_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "org_ai_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"memory_type" text NOT NULL,
	"content" text NOT NULL,
	"added_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "disabled_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "disabled_by" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "org_ai_configs" ADD CONSTRAINT "org_ai_configs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_ai_memory" ADD CONSTRAINT "org_ai_memory_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_ai_memory" ADD CONSTRAINT "org_ai_memory_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;