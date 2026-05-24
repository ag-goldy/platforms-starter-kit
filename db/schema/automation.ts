import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./tenancy";
import { users, platformAdmins } from "./identity";

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    priority: integer("priority").default(0).notNull(),
    trigger: text("trigger").notNull(), // 'ticket_created','ticket_updated','comment_added','status_changed','priority_changed','assignee_changed','sla_warning','sla_breached','schedule','webhook_received'
    conditionsJson: jsonb("conditions_json").notNull(),
    actionsJson: jsonb("actions_json").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByPlatformAdmin: uuid("created_by_platform_admin").references(
      () => platformAdmins.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return [
      check(
        "automation_trigger_check",
        sql`${table.trigger} IN ('ticket_created','ticket_updated','comment_added','status_changed','priority_changed','assignee_changed','sla_warning','sla_breached','schedule','webhook_received')`,
      ),
    ];
  },
);

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  automationId: uuid("automation_id")
    .notNull()
    .references(() => automations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id"),
  trigger: text("trigger").notNull(),
  matched: boolean("matched").default(false).notNull(),
  status: text("status").default("success").notNull(),
  actionsExecuted: integer("actions_executed").default(0),
  durationMs: integer("duration_ms").default(0),
  error: text("error"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
