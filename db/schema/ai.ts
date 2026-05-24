import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";

export const aiConfigs = pgTable("ai_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  systemPrompt: text("system_prompt"),
  maxTokens: integer("max_tokens").default(4096),
  temperature: integer("temperature").default(0),
  enabled: integer("enabled").default(1),
  settingsJson: jsonb("settings_json").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const aiAudit = pgTable("ai_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  userId: uuid("user_id"),
  requestHash: text("request_hash").notNull(),
  responseHash: text("response_hash").notNull(),
  promptId: text("prompt_id"),
  model: text("model"),
  tokensUsed: integer("tokens_used"),
  latencyMs: integer("latency_ms"),
  injectionScore: integer("injection_score"),
  piiRedacted: boolean("pii_redacted").default(false),
  metadataJson: jsonb("metadata_json").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
