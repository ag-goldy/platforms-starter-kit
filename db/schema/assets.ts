import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").default("OTHER").notNull(),
  status: text("status").default("ACTIVE").notNull(),
  hostname: text("hostname"),
  serialNumber: text("serial_number"),
  model: text("model"),
  vendor: text("vendor"),
  ipAddress: text("ip_address"),
  macAddress: text("mac_address"),
  siteId: uuid("site_id"),
  areaId: uuid("area_id"),
  parentAssetId: uuid("parent_asset_id"),
  monitoringExternalId: text("monitoring_external_id"),
  monitoringEnabled: boolean("monitoring_enabled").default(false),
  monitoringStatus: text("monitoring_status").default("UNKNOWN"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  uptimePercentage: decimal("uptime_percentage", { precision: 5, scale: 2 }),
  accessUrls: jsonb("access_urls"),
  tags: jsonb("tags"),
  notes: text("notes"),
  customFieldsJson: jsonb("custom_fields_json").default({}),
  archived: boolean("archived").default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const assetEvents = pgTable("asset_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  payloadJson: jsonb("payload_json").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
