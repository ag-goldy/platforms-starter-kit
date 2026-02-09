-- Migration: Notifications, KB, Mentions, Watchers
-- Created: 2026-02-02

-- Notification Types Enum
DO $$ BEGIN
  CREATE TYPE "notification_type" AS ENUM (
    'TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_ASSIGNED', 'TICKET_COMMENTED',
    'TICKET_STATUS_CHANGED', 'TICKET_PRIORITY_CHANGED', 'TICKET_RESOLVED',
    'TICKET_REOPENED', 'TICKET_MERGED', 'TICKET_ESCALATED', 'TICKET_SLA_BREACH',
    'TICKET_SLA_WARNING', 'USER_MENTIONED', 'ORG_INVITATION', 'ORG_ROLE_CHANGED',
    'INTERNAL_GROUP_ASSIGNED', 'AUTOMATION_TRIGGERED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notification Channel Enum
DO $$ BEGIN
  CREATE TYPE "notification_channel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notifications Table
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" "notification_type" NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "data" jsonb,
  "link" text,
  "read" boolean DEFAULT false NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email_enabled" boolean DEFAULT true NOT NULL,
  "email_digest_frequency" text DEFAULT 'immediate' NOT NULL,
  "email_types" jsonb DEFAULT '[]'::jsonb,
  "push_enabled" boolean DEFAULT true NOT NULL,
  "push_types" jsonb DEFAULT '[]'::jsonb,
  "in_app_enabled" boolean DEFAULT true NOT NULL,
  "in_app_types" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("user_id")
);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- User Mentions Table
CREATE TABLE IF NOT EXISTS "user_mentions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "comment_id" uuid NOT NULL REFERENCES "ticket_comments"("id") ON DELETE CASCADE,
  "mentioned_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("comment_id", "mentioned_user_id")
);
CREATE INDEX IF NOT EXISTS idx_user_mentions_comment ON user_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_user_mentions_user ON user_mentions(mentioned_user_id);

-- Ticket Watchers Table
CREATE TABLE IF NOT EXISTS "ticket_watchers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("ticket_id", "user_id")
);
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_ticket ON ticket_watchers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_user ON ticket_watchers(user_id);

-- Draft Tickets Table
CREATE TABLE IF NOT EXISTS "draft_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "subject" text,
  "description" text,
  "priority" text,
  "category" text,
  "requester_email" text,
  "site_id" uuid,
  "area_id" uuid,
  "form_data" jsonb,
  "attachments" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("org_id", "created_by")
);
CREATE INDEX IF NOT EXISTS idx_draft_tickets_org ON draft_tickets(org_id);
CREATE INDEX IF NOT EXISTS idx_draft_tickets_user ON draft_tickets(created_by);

-- KB Categories Table
CREATE TABLE IF NOT EXISTS "kb_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "parent_id" uuid REFERENCES "kb_categories"("id") ON DELETE SET NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("org_id", "slug")
);
CREATE INDEX IF NOT EXISTS idx_kb_categories_org ON kb_categories(org_id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_parent ON kb_categories(parent_id);

-- KB Articles Table
CREATE TABLE IF NOT EXISTS "kb_articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "category_id" uuid REFERENCES "kb_categories"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "content" text NOT NULL,
  "excerpt" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "visibility" text DEFAULT 'public' NOT NULL,
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "published_at" timestamp,
  "view_count" integer DEFAULT 0 NOT NULL,
  "helpful_count" integer DEFAULT 0 NOT NULL,
  "not_helpful_count" integer DEFAULT 0 NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("org_id", "slug")
);
CREATE INDEX IF NOT EXISTS idx_kb_articles_org ON kb_articles(org_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_visibility ON kb_articles(visibility);

-- KB Article Feedback Table
CREATE TABLE IF NOT EXISTS "kb_article_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "article_id" uuid NOT NULL REFERENCES "kb_articles"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "is_helpful" boolean NOT NULL,
  "comment" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kb_feedback_article ON kb_article_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_feedback_user ON kb_article_feedback(user_id);
