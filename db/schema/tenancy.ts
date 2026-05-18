import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  check,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Custom citext type since drizzle doesn't have a built-in one
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: citext("slug").unique().notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"), // 'active', 'suspended', 'deleted'
    plan: text("plan").notNull().default("trial"),
    region: text("region").notNull().default("sg"),
    customDomain: citext("custom_domain").unique(),
    subdomain: text("subdomain"), // Legacy column from old schema causing NOT NULL errors
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return [
      check("slug_format", sql`${table.slug} ~ '^[a-z0-9][a-z0-9-]{2,31}$'`),
      check(
        "status_enum",
        sql`${table.status} IN ('active', 'suspended', 'deleted')`,
      ),
    ];
  },
);

export const orgSettings = pgTable(
  "org_settings",
  {
    orgId: uuid("org_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    brandingJson: jsonb("branding_json").default({}),
    featuresJson: jsonb("features_json").default({}),
    businessHoursId: uuid("business_hours_id"), // Will reference business_hours table later
    dataRetentionDays: integer("data_retention_days").default(730),
    piiPolicy: text("pii_policy").default("standard"), // 'strict', 'standard', 'off'
    aiDataAccessJson: jsonb("ai_data_access_json").default({}),
  },
  (table) => {
    return [
      check(
        "pii_policy_enum",
        sql`${table.piiPolicy} IN ('strict', 'standard', 'off')`,
      ),
    ];
  },
);

// custom_domains table as mentioned in the comment but omitted from canonical sql, leaving out for now.
