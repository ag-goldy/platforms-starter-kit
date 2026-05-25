-- Migration: Add ticket_prefix to organizations and composite unique on tickets(org_id, key)
-- Applied manually due to Drizzle Kit journal drift (see docs/superpowers/ for tracking)

ALTER TABLE "organizations" ADD COLUMN "ticket_prefix" varchar(8);
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ticket_prefix_unique" UNIQUE("ticket_prefix");
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_org_id_key_unique" UNIQUE("org_id","key");
