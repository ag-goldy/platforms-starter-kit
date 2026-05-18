import {
  pgTable,
  uuid,
  text,
  timestamp,
  check,
  jsonb,
  integer,
  boolean,
  smallint,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./tenancy";
import { businessHours } from "./membership";

import { relations } from "drizzle-orm";

export const slaPolicies = pgTable("sla_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  matchersJson: jsonb("matchers_json").notNull(),
  responseMinutes: integer("response_minutes").notNull(),
  resolutionMinutes: integer("resolution_minutes").notNull(),
  pauseOnStatus: text("pause_on_status")
    .array()
    .default(["pending", "on_hold"]),
  businessHoursId: uuid("business_hours_id").references(() => businessHours.id),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const slaPoliciesRelations = relations(slaPolicies, ({ many }) => ({
  escalationRules: many(escalationRules),
}));

export const escalationRules = pgTable(
  "escalation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slaPolicyId: uuid("sla_policy_id").references(() => slaPolicies.id, {
      onDelete: "cascade",
    }),
    trigger: text("trigger"), // 'response_warn', 'response_breach', 'resolution_warn', 'resolution_breach', 'no_activity'
    thresholdPct: smallint("threshold_pct").default(80),
    thresholdMinutes: integer("threshold_minutes"),
    actionsJson: jsonb("actions_json").notNull(),
    active: boolean("active").default(true),
  },
  (table) => {
    return [
      check(
        "trigger_enum",
        sql`${table.trigger} IN ('response_warn', 'response_breach', 'resolution_warn', 'resolution_breach', 'no_activity')`,
      ),
    ];
  },
);

export const escalationRulesRelations = relations(
  escalationRules,
  ({ one }) => ({
    policy: one(slaPolicies, {
      fields: [escalationRules.slaPolicyId],
      references: [slaPolicies.id],
    }),
  }),
);
