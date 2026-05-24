import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  blobUrl: text("blob_url").notNull(),
  scanStatus: text("scan_status").default("pending").notNull(), // 'pending','clean','infected','error'
  scanResult: text("scan_result"),
  attachedToKind: text("attached_to_kind"), // 'ticket','kb','asset'
  attachedToId: uuid("attached_to_id"),
  metadataJson: jsonb("metadata_json").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
