import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";
import { users, platformAdmins } from "./identity";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  actorId: uuid("actor_id"),
  actorKind: text("actor_kind"), // 'user', 'platform_admin', 'system'
  action: text("action").notNull(),
  resource: text("resource").notNull(), // 'ticket', 'asset', 'kb_article', etc.
  resourceId: uuid("resource_id"),
  detailsJson: jsonb("details_json"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  signature: text("signature"), // HMAC-SHA256
  keyId: text("key_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const loginEvents = pgTable("login_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  platformAdminId: uuid("platform_admin_id").references(
    () => platformAdmins.id,
    { onDelete: "cascade" },
  ),
  event: text("event").notNull(), // 'success', 'failure', 'mfa_prompt', etc.
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
