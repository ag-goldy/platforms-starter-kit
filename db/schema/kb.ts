import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  check,
  unique,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./tenancy";
import { users } from "./identity";

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const kbCategories = pgTable("kb_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  parentId: uuid("parent_id"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const kbArticles = pgTable(
  "kb_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => kbCategories.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    slug: citext("slug").notNull(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    status: text("status").notNull().default("draft"), // 'draft','in_review','published','archived'
    visibility: text("visibility").notNull().default("authenticated"), // 'public','authenticated','restricted'
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedById: uuid("approved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    viewCount: integer("view_count").default(0),
    helpfulCount: integer("helpful_count").default(0),
    notHelpfulCount: integer("not_helpful_count").default(0),
    tags: text("tags").array().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => {
    return [
      unique("kb_articles_org_slug_unique").on(table.orgId, table.slug),
      check(
        "kb_status_check",
        sql`${table.status} IN ('draft','in_review','published','archived')`,
      ),
      check(
        "kb_visibility_check",
        sql`${table.visibility} IN ('public','authenticated','restricted')`,
      ),
    ];
  },
);

export const kbRevisions = pgTable("kb_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => kbArticles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  editorId: uuid("editor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  changeSummary: text("change_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const kbFeedback = pgTable("kb_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => kbArticles.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  helpful: boolean("helpful").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
