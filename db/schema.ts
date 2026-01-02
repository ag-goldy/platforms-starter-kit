import { pgTable, text, timestamp, uuid, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', [
  'ADMIN',
  'AGENT',
  'READONLY',
  'CUSTOMER_ADMIN',
  'REQUESTER',
  'VIEWER',
]);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'NEW',
  'OPEN',
  'WAITING_ON_CUSTOMER',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'P1',
  'P2',
  'P3',
  'P4',
]);

export const ticketCategoryEnum = pgEnum('ticket_category', [
  'INCIDENT',
  'SERVICE_REQUEST',
  'CHANGE_REQUEST',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'TICKET_CREATED',
  'TICKET_UPDATED',
  'TICKET_STATUS_CHANGED',
  'TICKET_ASSIGNED',
  'TICKET_PRIORITY_CHANGED',
  'TICKET_COMMENT_ADDED',
  'USER_INVITED',
  'USER_ROLE_CHANGED',
  'ORG_CREATED',
  'ORG_UPDATED',
]);

// Tables
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  subdomain: text('subdomain').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  isInternal: boolean('is_internal').default(false).notNull(),
  emailVerified: timestamp('email_verified'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  status: ticketStatusEnum('status').default('NEW').notNull(),
  priority: ticketPriorityEnum('priority').default('P3').notNull(),
  category: ticketCategoryEnum('category').default('INCIDENT').notNull(),
  requesterId: uuid('requester_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  requesterEmail: text('requester_email'),
  assigneeId: uuid('assignee_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ticketComments = pgTable('ticket_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  authorEmail: text('author_email'),
  content: text('content').notNull(),
  isInternal: boolean('is_internal').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const attachments = pgTable('attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  commentId: uuid('comment_id').references(() => ticketComments.id, {
    onDelete: 'cascade',
  }),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  storageKey: text('storage_key').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  orgId: uuid('org_id').references(() => organizations.id, {
    onDelete: 'set null',
  }),
  ticketId: uuid('ticket_id').references(() => tickets.id, {
    onDelete: 'set null',
  }),
  action: auditActionEnum('action').notNull(),
  details: text('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ticketTokens = pgTable('ticket_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  token: text('token').notNull().unique(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  tickets: many(tickets),
  auditLogs: many(auditLogs),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  requestedTickets: many(tickets, { relationName: 'requester' }),
  assignedTickets: many(tickets, { relationName: 'assignee' }),
  comments: many(ticketComments),
  attachments: many(attachments),
  auditLogs: many(auditLogs),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.orgId],
    references: [organizations.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tickets.orgId],
    references: [organizations.id],
  }),
  requester: one(users, {
    fields: [tickets.requesterId],
    references: [users.id],
    relationName: 'requester',
  }),
  assignee: one(users, {
    fields: [tickets.assigneeId],
    references: [users.id],
    relationName: 'assignee',
  }),
  comments: many(ticketComments),
  attachments: many(attachments),
  auditLogs: many(auditLogs),
  tokens: many(ticketTokens),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one, many }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketComments.userId],
    references: [users.id],
  }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [attachments.ticketId],
    references: [tickets.id],
  }),
  comment: one(ticketComments, {
    fields: [attachments.commentId],
    references: [ticketComments.id],
  }),
  uploadedBy: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.id],
  }),
  ticket: one(tickets, {
    fields: [auditLogs.ticketId],
    references: [tickets.id],
  }),
}));

export const ticketTokensRelations = relations(ticketTokens, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketTokens.ticketId],
    references: [tickets.id],
  }),
}));

// Types
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketComment = typeof ticketComments.$inferSelect;
export type NewTicketComment = typeof ticketComments.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type TicketToken = typeof ticketTokens.$inferSelect;
export type NewTicketToken = typeof ticketTokens.$inferInsert;

