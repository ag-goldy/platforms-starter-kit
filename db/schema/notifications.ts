import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { users, platformAdmins } from "./identity";
import { organizations } from "./tenancy";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(), // 'ticket_assigned','ticket_replied','ticket_status_changed','mention','sla_warn','sla_breach','kb_review_requested','digest_daily','digest_weekly'
  title: text("title").notNull(),
  message: text("message").notNull(),
  dataJson: jsonb("data_json"),
  link: text("link"),
  read: boolean("read").default(false).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    platformAdminId: uuid("platform_admin_id").references(
      () => platformAdmins.id,
      { onDelete: "cascade" },
    ),
    emailEnabled: boolean("email_enabled").default(true).notNull(),
    emailDigestFrequency: text("email_digest_frequency")
      .default("immediate")
      .notNull(),
    pushEnabled: boolean("push_enabled").default(true).notNull(),
    inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
    categoriesJson: jsonb("categories_json").default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
);
