import { pgTable, uuid, text, timestamp, integer, check, jsonb, smallint, primaryKey, customType, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './tenancy';
import { users } from './identity';
import { teams } from './membership';
import { slaPolicies } from './sla';
import { assets } from './assets';

const ticketTypeEnum = ['incident', 'request', 'problem', 'change'] as const;
const ticketStatusEnum = ['new', 'open', 'pending', 'on_hold', 'resolved', 'closed', 'merged'] as const;
const ticketPriorityEnum = ['p1', 'p2', 'p3', 'p4'] as const;
const ticketSourceEnum = ['portal', 'email', 'phone', 'chat', 'api', 'automation'] as const;

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  key: text('key'),
  title: text('title').notNull(),
  descriptionMd: text('description_md').notNull(),
  type: text('type').notNull().default('incident'),
  status: text('status').notNull().default('new'),
  priority: text('priority').notNull().default('p3'),
  source: text('source').notNull(),
  requesterId: uuid('requester_id').notNull().references(() => users.id),
  assigneeId: uuid('assignee_id').references(() => users.id),
  teamId: uuid('team_id').references(() => teams.id),
  slaPolicyId: uuid('sla_policy_id').references(() => slaPolicies.id),
  responseDueAt: timestamp('response_due_at', { withTimezone: true }),
  resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }),
  responseBreachedAt: timestamp('response_breached_at', { withTimezone: true }),
  resolutionBreachedAt: timestamp('resolution_breached_at', { withTimezone: true }),
  pausedAt: timestamp('paused_at', { withTimezone: true }),
  pausedTotalSeconds: integer('paused_total_seconds').default(0),
  // mergedIntoId: uuid('merged_into_id').references(() => tickets.id), // Added below to avoid circular reference issues if needed, but Drizzle supports it.
  mergedIntoId: uuid('merged_into_id'),
  customFieldsJson: jsonb('custom_fields_json').default({}),
  csatScore: smallint('csat_score'),
  csatComment: text('csat_comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => {
  return [
    check('type_check', sql`${table.type} IN ('incident','request','problem','change')`),
    check('status_check', sql`${table.status} IN ('new','open','pending','on_hold','resolved','closed','merged')`),
    check('priority_check', sql`${table.priority} IN ('p1','p2','p3','p4')`),
    check('source_check', sql`${table.source} IN ('portal','email','phone','chat','api','automation')`),
    check('csat_score_check', sql`${table.csatScore} BETWEEN 1 AND 5`),
    unique('tickets_org_id_number_unique').on(table.orgId, table.number),
  ];
});

export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').references(() => users.id),
  authorKind: text('author_kind'), // 'user', 'system', 'bot'
  bodyMd: text('body_md').notNull(),
  bodyHtmlSanitized: text('body_html_sanitized').notNull(),
  visibility: text('visibility').notNull(), // 'public', 'internal', 'system'
  channel: text('channel'), // 'portal', 'email', 'api', 'automation'
  emailMessageId: text('email_message_id'),
  emailInReplyTo: text('email_in_reply_to'),
  replyToId: uuid('reply_to_id'), // self reference to ticket_messages.id
  attachmentIds: uuid('attachment_ids').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => {
  return [
    check('author_kind_check', sql`${table.authorKind} IN ('user','system','bot')`),
    check('visibility_check', sql`${table.visibility} IN ('public','internal','system')`),
    check('channel_check', sql`${table.channel} IN ('portal','email','api','automation')`),
  ];
});

export const ticketEvents = pgTable('ticket_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id'),
  actorKind: text('actor_kind'),
  eventType: text('event_type').notNull(),
  payloadJson: jsonb('payload_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const ticketLinks = pgTable('ticket_links', {
  parentId: uuid('parent_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  childId: uuid('child_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  linkType: text('link_type').notNull(), // 'related','duplicate','blocks','blocked_by','parent','child'
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return [
    primaryKey({ columns: [table.parentId, table.childId, table.linkType] }),
    check('link_type_check', sql`${table.linkType} IN ('related','duplicate','blocks','blocked_by','parent','child')`),
  ];
});

export const ticketAssets = pgTable('ticket_assets', {
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
}, (table) => {
  return [
    primaryKey({ columns: [table.ticketId, table.assetId] }),
  ];
});

export const ticketWatchers = pgTable('ticket_watchers', {
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => {
  return [
    primaryKey({ columns: [table.ticketId, table.userId] }),
  ];
});
