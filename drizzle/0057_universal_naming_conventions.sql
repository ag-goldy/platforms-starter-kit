ALTER TABLE "organizations"
ADD COLUMN IF NOT EXISTS "customer_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_customer_id_unique"
ON "organizations" ("customer_id")
WHERE "customer_id" IS NOT NULL;
