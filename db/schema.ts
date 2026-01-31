import { pgTable, text, timestamp, uuid, integer, boolean, pgEnum, unique, jsonb } from 'drizzle-orm/pg-core';
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

export const internalGroupRoleEnum = pgEnum('internal_group_role', [
  'ADMIN',
  'MEMBER',
]);

export const internalGroupScopeEnum = pgEnum('internal_group_scope', [
  'PLATFORM',
  'ORG',
]);

export const internalGroupRoleTypeEnum = pgEnum('internal_group_role_type', [
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'SECURITY_ADMIN',
  'COMPLIANCE_AUDITOR',
  'BILLING_ADMIN',
  'INTEGRATION_ADMIN',
  'ORG_ADMIN',
  'SUPPORT_OPS_ADMIN',
  'TEAM_QUEUE_MANAGER',
  'SUPERVISOR',
  'AGENT',
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

export const assetTypeEnum = pgEnum('asset_type', [
  'AP',
  'SWITCH',
  'FIREWALL',
  'CAMERA',
  'NVR',
  'SERVER',
  'ISP_CIRCUIT',
  'OTHER',
]);

export const assetStatusEnum = pgEnum('asset_status', [
  'ACTIVE',
  'RETIRED',
  'MAINTENANCE',
]);

export const serviceStatusEnum = pgEnum('service_status', [
  'ACTIVE',
  'DEGRADED',
  'OFFLINE',
]);

export const noticeTypeEnum = pgEnum('notice_type', [
  'MAINTENANCE',
  'INCIDENT',
  'KNOWN_ISSUE',
]);

export const noticeSeverityEnum = pgEnum('notice_severity', [
  'INFO',
  'WARN',
  'CRITICAL',
]);

export const exportRequestStatusEnum = pgEnum('export_request_status', [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'TICKET_CREATED',
  'TICKET_UPDATED',
  'TICKET_STATUS_CHANGED',
  'TICKET_ASSIGNED',
  'TICKET_PRIORITY_CHANGED',
  'TICKET_COMMENT_ADDED',
  'TICKET_MERGED',
  'TICKET_TAG_ADDED',
  'TICKET_TAG_REMOVED',
  'USER_INVITED',
  'USER_ROLE_CHANGED',
  'USER_UPDATED',
  'USER_2FA_ENABLED',
  'USER_2FA_DISABLED',
  'USER_2FA_BACKUP_CODES_REGENERATED',
  'ORG_CREATED',
  'ORG_UPDATED',
  'EXPORT_REQUESTED',
  'MEMBERSHIP_DEACTIVATED',
]);

export const ticketTokenPurposeEnum = pgEnum('ticket_token_purpose', [
  'VIEW',
  'REPLY',
]);

export const emailStatusEnum = pgEnum('email_status', [
  'PENDING',
  'SENT',
  'FAILED',
]);

export const automationTriggerEnum = pgEnum('automation_trigger', [
  'ASSIGNED',
  'COMMENT_ADDED',
  'PRIORITY_CHANGED',
  'SLA_BREACHED',
  'SLA_WARNING',
  'STATUS_CHANGED',
  'TICKET_CREATED',
  'TICKET_UPDATED',
  'TIME_BASED',
  'UNASSIGNED',
  'WEBHOOK',
]);

// Tables
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  subdomain: text('subdomain').notNull().unique(),
  allowPublicIntake: boolean('allow_public_intake').default(true).notNull(),
  storageQuotaBytes: integer('storage_quota_bytes').default(10737418240), // Default 10GB
  storageUsedBytes: integer('storage_used_bytes').default(0),
  businessHours: jsonb('business_hours').$type<{
    timezone: string;
    workingDays: number[]; // 1=Monday, 7=Sunday
    workingHours: { start: string; end: string };
    holidays: string[]; // ISO date strings
  } | null>(),
  branding: jsonb('branding').$type<{
    nameOverride?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
  } | null>(),
  features: jsonb('features').$type<{
    assets?: boolean;
    exports?: boolean;
    team?: boolean;
    services?: boolean;
    knowledge?: boolean;
  } | null>(),
  dataRetentionDays: integer('data_retention_days'),
  retentionPolicy: text('retention_policy').$type<'KEEP_FOREVER' | 'DELETE_AFTER_DAYS' | 'ANONYMIZE_AFTER_DAYS' | null>(),
  requireTwoFactor: boolean('require_two_factor').default(false).notNull(),
  // SLA Policy - response/resolution hours per priority
  slaResponseHoursP1: integer('sla_response_hours_p1'),
  slaResponseHoursP2: integer('sla_response_hours_p2'),
  slaResponseHoursP3: integer('sla_response_hours_p3'),
  slaResponseHoursP4: integer('sla_response_hours_p4'),
  slaResolutionHoursP1: integer('sla_resolution_hours_p1'),
  slaResolutionHoursP2: integer('sla_resolution_hours_p2'),
  slaResolutionHoursP3: integer('sla_resolution_hours_p3'),
  slaResolutionHoursP4: integer('sla_resolution_hours_p4'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const services = pgTable('services', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  status: serviceStatusEnum('status').default('ACTIVE').notNull(),
  isUnderContract: boolean('is_under_contract').default(false).notNull(),
  businessHours: jsonb('business_hours').$type<{
    timezone: string;
    workingDays: number[];
    workingHours: { start: string; end: string };
    holidays?: string[];
  } | null>(),
  slaResponseHoursP1: integer('sla_response_hours_p1'),
  slaResponseHoursP2: integer('sla_response_hours_p2'),
  slaResponseHoursP3: integer('sla_response_hours_p3'),
  slaResponseHoursP4: integer('sla_response_hours_p4'),
  slaResolutionHoursP1: integer('sla_resolution_hours_p1'),
  slaResolutionHoursP2: integer('sla_resolution_hours_p2'),
  slaResolutionHoursP3: integer('sla_resolution_hours_p3'),
  slaResolutionHoursP4: integer('sla_resolution_hours_p4'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueOrgSlug: unique('services_org_slug_unique').on(table.orgId, table.slug),
}));

export const requestTypes = pgTable(
  'request_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    category: ticketCategoryEnum('category').default('SERVICE_REQUEST').notNull(),
    defaultPriority: ticketPriorityEnum('default_priority').default('P3').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    formSchema: jsonb('form_schema').$type<{
      version?: number;
      fields: Array<{
        id: string;
        label: string;
        type:
          | 'text'
          | 'textarea'
          | 'number'
          | 'select'
          | 'multiselect'
          | 'checkbox'
          | 'date'
          | 'fileHint';
        required?: boolean;
        placeholder?: string;
        helperText?: string;
        options?: Array<{ label: string; value: string }>;
      }>;
    }>(),
    requiredAttachments: boolean('required_attachments').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueOrgSlug: unique('request_types_org_slug_unique').on(
      table.orgId,
      table.slug
    ),
  })
);

export const sites = pgTable(
  'sites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    address: text('address'),
    timezone: text('timezone'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueOrgSlug: unique('sites_org_slug_unique').on(table.orgId, table.slug),
  })
);

export const areas = pgTable(
  'areas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    floor: text('floor'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueSiteName: unique('areas_site_name_unique').on(table.siteId, table.name),
  })
);

export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),
  type: assetTypeEnum('type').default('OTHER').notNull(),
  name: text('name').notNull(),
  hostname: text('hostname'),
  serialNumber: text('serial_number'),
  model: text('model'),
  vendor: text('vendor'),
  ipAddress: text('ip_address'),
  macAddress: text('mac_address'),
  tags: jsonb('tags').$type<string[] | null>(),
  notes: text('notes'),
  status: assetStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  phone: text('phone'),
  jobTitle: text('job_title'),
  department: text('department'),
  notes: text('notes'),
  managerId: uuid('manager_id'),
  isInternal: boolean('is_internal').default(false).notNull(),
  emailVerified: timestamp('email_verified'),
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  twoFactorSecret: text('two_factor_secret'),
  twoFactorBackupCodes: text('two_factor_backup_codes'), // JSON array of hashed codes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const internalGroups = pgTable(
  'internal_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    scope: internalGroupScopeEnum('scope').default('PLATFORM').notNull(),
    orgId: uuid('org_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    roleType: internalGroupRoleTypeEnum('role_type').notNull(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueName: unique('internal_groups_name_unique').on(table.name),
  })
);

export const internalGroupMemberships = pgTable(
  'internal_group_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => internalGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: internalGroupRoleEnum('role').default('MEMBER').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueMembership: unique('internal_group_memberships_group_user_unique').on(
      table.groupId,
      table.userId
    ),
  })
);

export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  deactivatedAt: timestamp('deactivated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
  requestTypeId: uuid('request_type_id').references(() => requestTypes.id, {
    onDelete: 'set null',
  }),
  requestPayload: jsonb('request_payload').$type<Record<string, unknown> | null>(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  status: ticketStatusEnum('status').default('NEW').notNull(),
  priority: ticketPriorityEnum('priority').default('P3').notNull(),
  category: ticketCategoryEnum('category').default('INCIDENT').notNull(),
  requesterId: uuid('requester_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  requesterEmail: text('requester_email'),
  ccEmails: jsonb('cc_emails').$type<string[] | null>(),
  assigneeId: uuid('assignee_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  mergedIntoId: uuid('merged_into_id'),
  emailThreadId: text('email_thread_id'),
  firstResponseAt: timestamp('first_response_at'),
  resolvedAt: timestamp('resolved_at'),
  slaResponseTargetHours: integer('sla_response_target_hours'),
  slaResolutionTargetHours: integer('sla_resolution_target_hours'),
  slaPausedAt: timestamp('sla_paused_at'),
  slaPauseReason: text('sla_pause_reason'),
  deletedAt: timestamp('deleted_at'),
  isAnonymized: boolean('is_anonymized').default(false),
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
  messageId: text('message_id'),
  inReplyTo: text('in_reply_to'),
  references: text('references'),
  deletedAt: timestamp('deleted_at'),
  isAnonymized: boolean('is_anonymized').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const attachments = pgTable('attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  commentId: uuid('comment_id').references(() => ticketComments.id, {
    onDelete: 'cascade',
  }),
  filename: text('filename').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  blobPathname: text('blob_pathname').notNull(),
  storageKey: text('storage_key').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  scanStatus: text('scan_status').default('PENDING'), // 'PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'ERROR'
  scanResult: text('scan_result'), // Details about the scan (virus name, error message, etc.)
  scannedAt: timestamp('scanned_at'),
  isQuarantined: boolean('is_quarantined').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ticketAssets = pgTable(
  'ticket_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueTicketAsset: unique('ticket_assets_ticket_asset_unique').on(
      table.ticketId,
      table.assetId
    ),
  })
);

export const notices = pgTable('notices', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  type: noticeTypeEnum('type').default('MAINTENANCE').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  isActive: boolean('is_active').default(true).notNull(),
  severity: noticeSeverityEnum('severity').default('INFO').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const exportRequests = pgTable('export_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  requestedById: uuid('requested_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: exportRequestStatusEnum('status').default('PENDING').notNull(),
  jobId: text('job_id'),
  filename: text('filename'),
  blobPathname: text('blob_pathname'),
  storageKey: text('storage_key'),
  expiresAt: timestamp('expires_at'),
  completedAt: timestamp('completed_at'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  tokenHash: text('token_hash').notNull().unique(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  purpose: ticketTokenPurposeEnum('purpose').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  lastSentAt: timestamp('last_sent_at'),
  createdIp: text('created_ip'),
  usedIp: text('used_ip'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const failedJobs = pgTable('failed_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: text('job_id').notNull(),
  type: text('type').notNull(),
  data: jsonb('data').notNull(),
  error: text('error').notNull(),
  attempts: integer('attempts').notNull(),
  maxAttempts: integer('max_attempts').notNull(),
  failedAt: timestamp('failed_at').defaultNow().notNull(),
  retriedAt: timestamp('retried_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text'),
  status: emailStatusEnum('status').default('PENDING').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  lastError: text('last_error'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ticketTemplates = pgTable('ticket_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  internalOnly: boolean('internal_only').default(false).notNull(),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ticketTags = pgTable('ticket_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').default('#3b82f6').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ticketTagAssignments = pgTable('ticket_tag_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id')
    .notNull()
    .references(() => ticketTags.id, { onDelete: 'cascade' }),
  assignedById: uuid('assigned_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ticketMerges = pgTable('ticket_merges', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceTicketId: uuid('source_ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  targetTicketId: uuid('target_ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  mergedById: uuid('merged_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cannedResponses = pgTable('canned_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  shortcut: text('shortcut'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ticketLinks = pgTable('ticket_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceTicketId: uuid('source_ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  targetTicketId: uuid('target_ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  linkType: text('link_type').notNull(), // 'related', 'duplicate', 'blocks', 'blocked_by'
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueLink: unique().on(table.sourceTicketId, table.targetTicketId, table.linkType),
}));

export const automationRules = pgTable('automation_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  enabled: boolean('is_enabled').default(true).notNull(),
  priority: integer('priority').default(0).notNull(),
  triggerOn: automationTriggerEnum('trigger').notNull(),
  conditions: jsonb('conditions').notNull(),
  actions: jsonb('actions').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userInvitations = pgTable('user_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: userRoleEnum('role').notNull(),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: text('session_token').notNull().unique(),
  deviceInfo: text('device_info'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  tickets: many(tickets),
  auditLogs: many(auditLogs),
  automationRules: many(automationRules),
  requestTypes: many(requestTypes),
  sites: many(sites),
  assets: many(assets),
  notices: many(notices),
  exportRequests: many(exportRequests),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  internalGroupMemberships: many(internalGroupMemberships),
  requestedTickets: many(tickets, { relationName: 'requester' }),
  assignedTickets: many(tickets, { relationName: 'assignee' }),
  comments: many(ticketComments),
  attachments: many(attachments),
  auditLogs: many(auditLogs),
  sentInvitations: many(userInvitations, { relationName: 'inviter' }),
  sessions: many(userSessions),
  notices: many(notices),
  exportRequests: many(exportRequests),
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

export const requestTypesRelations = relations(requestTypes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [requestTypes.orgId],
    references: [organizations.id],
  }),
  tickets: many(tickets),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sites.orgId],
    references: [organizations.id],
  }),
  areas: many(areas),
  assets: many(assets),
  notices: many(notices),
}));

export const areasRelations = relations(areas, ({ one, many }) => ({
  site: one(sites, {
    fields: [areas.siteId],
    references: [sites.id],
  }),
  assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [assets.orgId],
    references: [organizations.id],
  }),
  site: one(sites, {
    fields: [assets.siteId],
    references: [sites.id],
  }),
  area: one(areas, {
    fields: [assets.areaId],
    references: [areas.id],
  }),
  ticketAssets: many(ticketAssets),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [services.orgId],
    references: [organizations.id],
  }),
  tickets: many(tickets),
}));

export const internalGroupsRelations = relations(internalGroups, ({ many, one }) => ({
  memberships: many(internalGroupMemberships),
  createdBy: one(users, {
    fields: [internalGroups.createdBy],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [internalGroups.orgId],
    references: [organizations.id],
  }),
}));

export const internalGroupMembershipsRelations = relations(
  internalGroupMemberships,
  ({ one }) => ({
    group: one(internalGroups, {
      fields: [internalGroupMemberships.groupId],
      references: [internalGroups.id],
    }),
    user: one(users, {
      fields: [internalGroupMemberships.userId],
      references: [users.id],
    }),
  })
);

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tickets.orgId],
    references: [organizations.id],
  }),
  service: one(services, {
    fields: [tickets.serviceId],
    references: [services.id],
  }),
  requestType: one(requestTypes, {
    fields: [tickets.requestTypeId],
    references: [requestTypes.id],
  }),
  site: one(sites, {
    fields: [tickets.siteId],
    references: [sites.id],
  }),
  area: one(areas, {
    fields: [tickets.areaId],
    references: [areas.id],
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
  mergedInto: one(tickets, {
    fields: [tickets.mergedIntoId],
    references: [tickets.id],
    relationName: 'mergedInto',
  }),
  mergedTickets: many(tickets, { relationName: 'mergedInto' }),
  comments: many(ticketComments),
  attachments: many(attachments),
  ticketAssets: many(ticketAssets),
  auditLogs: many(auditLogs),
  tokens: many(ticketTokens),
  tagAssignments: many(ticketTagAssignments),
  sourceMerges: many(ticketMerges, { relationName: 'sourceTicket' }),
  targetMerges: many(ticketMerges, { relationName: 'targetTicket' }),
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
  organization: one(organizations, {
    fields: [attachments.orgId],
    references: [organizations.id],
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

export const ticketAssetsRelations = relations(ticketAssets, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketAssets.ticketId],
    references: [tickets.id],
  }),
  asset: one(assets, {
    fields: [ticketAssets.assetId],
    references: [assets.id],
  }),
}));

export const noticesRelations = relations(notices, ({ one }) => ({
  organization: one(organizations, {
    fields: [notices.orgId],
    references: [organizations.id],
  }),
  site: one(sites, {
    fields: [notices.siteId],
    references: [sites.id],
  }),
  createdBy: one(users, {
    fields: [notices.createdByUserId],
    references: [users.id],
  }),
}));

export const exportRequestsRelations = relations(exportRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [exportRequests.orgId],
    references: [organizations.id],
  }),
  requestedBy: one(users, {
    fields: [exportRequests.requestedById],
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

export const ticketTemplatesRelations = relations(ticketTemplates, ({ one }) => ({
  createdBy: one(users, {
    fields: [ticketTemplates.createdById],
    references: [users.id],
  }),
}));

export const ticketTagsRelations = relations(ticketTags, ({ many }) => ({
  assignments: many(ticketTagAssignments),
}));

export const ticketTagAssignmentsRelations = relations(ticketTagAssignments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketTagAssignments.ticketId],
    references: [tickets.id],
  }),
  tag: one(ticketTags, {
    fields: [ticketTagAssignments.tagId],
    references: [ticketTags.id],
  }),
  assignedBy: one(users, {
    fields: [ticketTagAssignments.assignedById],
    references: [users.id],
  }),
}));

export const ticketMergesRelations = relations(ticketMerges, ({ one }) => ({
  sourceTicket: one(tickets, {
    fields: [ticketMerges.sourceTicketId],
    references: [tickets.id],
    relationName: 'sourceTicket',
  }),
  targetTicket: one(tickets, {
    fields: [ticketMerges.targetTicketId],
    references: [tickets.id],
    relationName: 'targetTicket',
  }),
  mergedBy: one(users, {
    fields: [ticketMerges.mergedById],
    references: [users.id],
  }),
}));

// Types
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RequestType = typeof requestTypes.$inferSelect;
export type NewRequestType = typeof requestTypes.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type InternalGroup = typeof internalGroups.$inferSelect;
export type NewInternalGroup = typeof internalGroups.$inferInsert;
export type InternalGroupMembership = typeof internalGroupMemberships.$inferSelect;
export type NewInternalGroupMembership = typeof internalGroupMemberships.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketComment = typeof ticketComments.$inferSelect;
export type NewTicketComment = typeof ticketComments.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type TicketAsset = typeof ticketAssets.$inferSelect;
export type NewTicketAsset = typeof ticketAssets.$inferInsert;
export type Notice = typeof notices.$inferSelect;
export type NewNotice = typeof notices.$inferInsert;
export type ExportRequest = typeof exportRequests.$inferSelect;
export type NewExportRequest = typeof exportRequests.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type TicketToken = typeof ticketTokens.$inferSelect;
export type NewTicketToken = typeof ticketTokens.$inferInsert;
export type EmailOutbox = typeof emailOutbox.$inferSelect;
export type NewEmailOutbox = typeof emailOutbox.$inferInsert;
export type TicketTemplate = typeof ticketTemplates.$inferSelect;
export type NewTicketTemplate = typeof ticketTemplates.$inferInsert;
export type TicketTag = typeof ticketTags.$inferSelect;
export type NewTicketTag = typeof ticketTags.$inferInsert;
export type TicketTagAssignment = typeof ticketTagAssignments.$inferSelect;
export type NewTicketTagAssignment = typeof ticketTagAssignments.$inferInsert;
export type TicketMerge = typeof ticketMerges.$inferSelect;
export type NewTicketMerge = typeof ticketMerges.$inferInsert;
export type AutomationRule = typeof automationRules.$inferSelect;
export type NewAutomationRule = typeof automationRules.$inferInsert;
export type UserInvitation = typeof userInvitations.$inferSelect;
export type NewUserInvitation = typeof userInvitations.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
