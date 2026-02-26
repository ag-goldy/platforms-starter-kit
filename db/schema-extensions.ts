// ============================================
// Schema Extensions for Comprehensive Improvements
// ============================================
import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, decimal, date, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations, tickets, users, kbArticles, ticketComments, automationRules } from './schema';

// Widget Configuration (part of organizations - added via migration)
export const widgetConfigSchema = {
  enabled: ['tickets', 'kb', 'health', 'quick_actions'] as string[],
  layout: 'grid' as 'grid' | 'list',
  customOrder: ['tickets', 'kb', 'health', 'quick_actions'] as string[],
};

// Time Tracking
export const timeEntries = pgTable('time_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  durationMinutes: integer('duration_minutes'),
  description: text('description'),
  isBillable: boolean('is_billable').default(true),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  source: text('source').default('manual'), // 'manual', 'timer', 'automatic'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  ticket: one(tickets, {
    fields: [timeEntries.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
}));

// Ticket Subtasks
export const ticketSubtasks = pgTable('ticket_subtasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('todo'), // 'todo', 'in_progress', 'done'
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date'),
  sortOrder: integer('sort_order').default(0),
  completedAt: timestamp('completed_at'),
  completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ticketSubtasksRelations = relations(ticketSubtasks, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketSubtasks.ticketId],
    references: [tickets.id],
  }),
  assignee: one(users, {
    fields: [ticketSubtasks.assigneeId],
    references: [users.id],
    relationName: 'assignee',
  }),
  completedByUser: one(users, {
    fields: [ticketSubtasks.completedBy],
    references: [users.id],
    relationName: 'completedBy',
  }),
  creator: one(users, {
    fields: [ticketSubtasks.createdBy],
    references: [users.id],
    relationName: 'creator',
  }),
}));

// Ticket Dependencies
export const ticketDependencies = pgTable('ticket_dependencies', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  dependsOnTicketId: uuid('depends_on_ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  dependencyType: text('dependency_type').default('blocks'), // 'blocks', 'blocked_by', 'relates_to'
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueDependency: unique('unique_dependency').on(table.ticketId, table.dependsOnTicketId),
}));

export const ticketDependenciesRelations = relations(ticketDependencies, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketDependencies.ticketId],
    references: [tickets.id],
    relationName: 'ticket',
  }),
  dependsOnTicket: one(tickets, {
    fields: [ticketDependencies.dependsOnTicketId],
    references: [tickets.id],
    relationName: 'dependsOnTicket',
  }),
  creator: one(users, {
    fields: [ticketDependencies.createdBy],
    references: [users.id],
  }),
}));

// Draft Autosave
export const ticketDrafts = pgTable('ticket_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  draftType: text('draft_type').notNull().default('comment'), // 'comment', 'internal_note', 'reply'
  content: text('content').notNull(),
  attachments: jsonb('attachments').$type<string[]>().default([]),
  lastSavedAt: timestamp('last_saved_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserTicketDraft: unique('unique_user_ticket_draft').on(table.userId, table.ticketId, table.draftType),
}));

export const ticketDraftsRelations = relations(ticketDrafts, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketDrafts.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketDrafts.userId],
    references: [users.id],
  }),
}));

// Collision Detection
export const ticketEditSessions = pgTable('ticket_edit_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(true),
  userName: text('user_name'),
  userAvatar: text('user_avatar'),
});

export const ticketEditSessionsRelations = relations(ticketEditSessions, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketEditSessions.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketEditSessions.userId],
    references: [users.id],
  }),
}));

// PII Detection Rules
export const piiDetectionRules = pgTable('pii_detection_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  patternName: text('pattern_name').notNull(),
  patternRegex: text('pattern_regex').notNull(),
  severity: text('severity').default('high'), // 'low', 'medium', 'high', 'critical'
  action: text('action').default('mask'), // 'mask', 'block', 'warn', 'flag'
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const piiDetectionRulesRelations = relations(piiDetectionRules, ({ one }) => ({
  organization: one(organizations, {
    fields: [piiDetectionRules.orgId],
    references: [organizations.id],
  }),
}));

// PII Detections Log
export const piiDetections = pgTable('pii_detections', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'cascade' }),
  commentId: uuid('comment_id').references(() => ticketComments.id, { onDelete: 'cascade' }),
  ruleId: uuid('rule_id').references(() => piiDetectionRules.id, { onDelete: 'set null' }),
  detectedText: text('detected_text'),
  maskedText: text('masked_text'),
  severity: text('severity'),
  actionTaken: text('action_taken'),
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
  detectedByUserId: uuid('detected_by_user_id').references(() => users.id, { onDelete: 'set null' }),
});

// KB Article Analytics
export const kbArticleAnalytics = pgTable('kb_article_analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  articleId: uuid('article_id').notNull().references(() => kbArticles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  sessionId: text('session_id'),
  action: text('action').notNull(), // 'view', 'search_found', 'helpful', 'not_helpful', 'share', 'print'
  searchQuery: text('search_query'),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const kbArticleAnalyticsRelations = relations(kbArticleAnalytics, ({ one }) => ({
  article: one(kbArticles, {
    fields: [kbArticleAnalytics.articleId],
    references: [kbArticles.id],
  }),
  user: one(users, {
    fields: [kbArticleAnalytics.userId],
    references: [users.id],
  }),
}));

// Webhook Subscriptions
export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  secret: text('secret'),
  events: text('events').array().notNull(),
  isActive: boolean('is_active').default(true),
  retryCount: integer('retry_count').default(3),
  timeoutSeconds: integer('timeout_seconds').default(30),
  customHeaders: jsonb('custom_headers'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastTriggeredAt: timestamp('last_triggered_at'),
  lastError: text('last_error'),
  lastSuccessAt: timestamp('last_success_at'),
});

export const webhookSubscriptionsRelations = relations(webhookSubscriptions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [webhookSubscriptions.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [webhookSubscriptions.createdBy],
    references: [users.id],
  }),
  deliveries: many(webhookDeliveries),
}));

// Webhook Deliveries
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  webhookId: uuid('webhook_id').notNull().references(() => webhookSubscriptions.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  errorMessage: text('error_message'),
  attemptNumber: integer('attempt_number').default(1),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhookSubscriptions, {
    fields: [webhookDeliveries.webhookId],
    references: [webhookSubscriptions.id],
  }),
}));

// Integration Configs
export const integrationConfigs = pgTable('integration_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'slack', 'teams', 'jira', 'github', 'salesforce'
  config: jsonb('config').notNull(),
  isActive: boolean('is_active').default(true),
  credentialsEncrypted: text('credentials_encrypted'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastSyncAt: timestamp('last_sync_at'),
  lastError: text('last_error'),
}, (table) => ({
  uniqueOrgProvider: unique('unique_org_provider').on(table.orgId, table.provider),
}));

export const integrationConfigsRelations = relations(integrationConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrationConfigs.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [integrationConfigs.createdBy],
    references: [users.id],
  }),
}));

// Agent Metrics
export const agentMetrics = pgTable('agent_metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  metricDate: date('metric_date').notNull(),
  ticketsAssigned: integer('tickets_assigned').default(0),
  ticketsResolved: integer('tickets_resolved').default(0),
  ticketsReopened: integer('tickets_reopened').default(0),
  avgFirstResponseMinutes: integer('avg_first_response_minutes'),
  avgResolutionMinutes: integer('avg_resolution_minutes'),
  avgCsatRating: decimal('avg_csat_rating', { precision: 3, scale: 2 }),
  totalTimeTrackedMinutes: integer('total_time_tracked_minutes').default(0),
  internalNotesCount: integer('internal_notes_count').default(0),
  customerRepliesCount: integer('customer_replies_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserDate: unique('unique_user_date').on(table.userId, table.metricDate),
}));

export const agentMetricsRelations = relations(agentMetrics, ({ one }) => ({
  user: one(users, {
    fields: [agentMetrics.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [agentMetrics.orgId],
    references: [organizations.id],
  }),
}));

// Scheduled Reports
export const scheduledReports = pgTable('scheduled_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  reportType: text('report_type').notNull(), // 'ticket_volume', 'agent_performance', 'sla_compliance', 'custom'
  config: jsonb('config').notNull(),
  schedule: text('schedule').notNull(), // cron expression
  recipients: text('recipients').array().notNull(),
  format: text('format').default('pdf'), // 'pdf', 'csv', 'xlsx'
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const scheduledReportsRelations = relations(scheduledReports, ({ one }) => ({
  organization: one(organizations, {
    fields: [scheduledReports.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [scheduledReports.createdBy],
    references: [users.id],
  }),
}));

// Visual Workflow Configs
export const workflowVisualConfigs = pgTable('workflow_visual_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nodes: jsonb('nodes').notNull(),
  edges: jsonb('edges').notNull(),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workflowVisualConfigsRelations = relations(workflowVisualConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [workflowVisualConfigs.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [workflowVisualConfigs.createdBy],
    references: [users.id],
  }),
}));

// Type Exports
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type TicketSubtask = typeof ticketSubtasks.$inferSelect;
export type NewTicketSubtask = typeof ticketSubtasks.$inferInsert;
export type TicketDependency = typeof ticketDependencies.$inferSelect;
export type NewTicketDependency = typeof ticketDependencies.$inferInsert;
export type TicketDraft = typeof ticketDrafts.$inferSelect;
export type NewTicketDraft = typeof ticketDrafts.$inferInsert;
export type TicketEditSession = typeof ticketEditSessions.$inferSelect;
export type NewTicketEditSession = typeof ticketEditSessions.$inferInsert;
export type PiiDetectionRule = typeof piiDetectionRules.$inferSelect;
export type NewPiiDetectionRule = typeof piiDetectionRules.$inferInsert;
export type PiiDetection = typeof piiDetections.$inferSelect;
export type NewPiiDetection = typeof piiDetections.$inferInsert;
export type KbArticleAnalytic = typeof kbArticleAnalytics.$inferSelect;
export type NewKbArticleAnalytic = typeof kbArticleAnalytics.$inferInsert;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type IntegrationConfig = typeof integrationConfigs.$inferSelect;
export type NewIntegrationConfig = typeof integrationConfigs.$inferInsert;
export type AgentMetric = typeof agentMetrics.$inferSelect;
export type NewAgentMetric = typeof agentMetrics.$inferInsert;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type NewScheduledReport = typeof scheduledReports.$inferInsert;
export type WorkflowVisualConfig = typeof workflowVisualConfigs.$inferSelect;
export type NewWorkflowVisualConfig = typeof workflowVisualConfigs.$inferInsert;
