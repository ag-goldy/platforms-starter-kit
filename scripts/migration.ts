import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import {
  renderMigrationMarkdown,
  type MigrationReport,
  type MigrationTableReport,
} from "@/lib/migration/report";

type Mode = MigrationReport["mode"];

interface CliOptions {
  mode: Mode;
  source: string;
  target: string;
  since?: string;
  reportDir: string;
  batchSize: number;
}

interface ColumnMap {
  [targetColumn: string]: string;
}

interface TableMigration {
  domain: string;
  table: string;
  sourceTable?: string;
  targetTable?: string;
  columnMap?: ColumnMap;
  customMigrate?: (
    source: postgres.Sql,
    target: postgres.Sql,
    since?: string,
    batchSize?: number,
  ) => Promise<number>;
  customValidate?: (
    source: postgres.Sql,
    target: postgres.Sql,
  ) => Promise<string[]>;
}

function usage(exitCode = 1): never {
  console.error(`Usage:
  pnpm migration:dry-run -- --source <url> --target <url>
  pnpm migration:run -- --source <url> --target <url> [--since <timestamp>]
  pnpm migration:validate -- --source <url> --target <url>

Options:
  --source <url>       Source Postgres URL
  --target <url>       Target Postgres URL
  --since <timestamp>  Optional incremental lower bound (ISO 8601)
  --report-dir <dir>   Report output directory (default: migration-reports)
  --batch-size <n>     Insert batch size (default: 1000)`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]): CliOptions {
  const [rawMode, ...rawRest] = argv;
  const rest = rawRest.filter((arg) => arg !== "--");
  if (!rawMode || !["dry-run", "run", "validate"].includes(rawMode)) usage();

  const options: Partial<CliOptions> = {
    mode: rawMode as Mode,
    reportDir: "migration-reports",
    batchSize: 1000,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    const value = rest[index + 1];
    if (key === "--help" || key === "-h") usage(0);
    if (!value) usage();

    if (key === "--source") options.source = value;
    else if (key === "--target") options.target = value;
    else if (key === "--since") options.since = value;
    else if (key === "--report-dir") options.reportDir = value;
    else if (key === "--batch-size") options.batchSize = Number(value);
    else usage();

    index += 1;
  }

  if (!options.source || !options.target) usage();
  if (!Number.isFinite(options.batchSize) || options.batchSize! < 1) usage();

  return options as CliOptions;
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function placeholders(rowCount: number, columnCount: number): string {
  const rows: string[] = [];
  let position = 1;
  for (let row = 0; row < rowCount; row += 1) {
    const columns: string[] = [];
    for (let column = 0; column < columnCount; column += 1) {
      columns.push(`$${position}`);
      position += 1;
    }
    rows.push(`(${columns.join(", ")})`);
  }
  return rows.join(", ");
}

async function tableExists(sql: postgres.Sql, table: string): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = ${table}
    ) as exists
  `;
  return rows[0]?.exists === true;
}

async function countRows(sql: postgres.Sql, table: string): Promise<number> {
  const rows = await sql.unsafe<{ count: string }[]>(
    `select count(*)::text as count from ${quoteIdent(table)}`,
  );
  return Number(rows[0]?.count || 0);
}

async function sampleIds(
  sql: postgres.Sql,
  table: string,
  limit: number,
): Promise<string[]> {
  const rows = await sql.unsafe<{ id: string }[]>(
    `select id::text as id from ${quoteIdent(table)} order by id limit $1`,
    [limit],
  );
  return rows.map((row) => row.id);
}

async function* fetchBatches(
  sql: postgres.Sql,
  query: string,
  batchSize: number,
) {
  let offset = 0;
  while (true) {
    const rows = await sql.unsafe<Record<string, unknown>[]>(
      `${query} limit ${batchSize} offset ${offset}`,
    );
    if (rows.length === 0) break;
    yield rows;
    offset += batchSize;
  }
}

async function insertBatch(
  target: postgres.Sql,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const values: unknown[] = rows.flatMap((row) =>
    columns.map((col) => row[col] ?? null),
  );
  const quotedColumns = columns.map(quoteIdent).join(", ");
  await target.unsafe(
    `insert into ${quoteIdent(table)} (${quotedColumns}) values ${placeholders(rows.length, columns.length)} on conflict do nothing`,
    values as any[],
  );
}

async function migrateSimpleTable(
  source: postgres.Sql,
  target: postgres.Sql,
  sourceTable: string,
  targetTable: string,
  columnMap: ColumnMap,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const sinceClause = since
    ? `where created_at >= '${since}'::timestamptz`
    : "";
  const selectCols = Object.entries(columnMap)
    .map(([target, sourceExpr]) => `${sourceExpr} as ${quoteIdent(target)}`)
    .join(", ");
  const query = `select ${selectCols} from ${quoteIdent(sourceTable)} ${sinceClause} order by id`;

  let inserted = 0;
  const targetCols = Object.keys(columnMap);
  for await (const batch of fetchBatches(source, query, batchSize)) {
    await insertBatch(target, targetTable, targetCols, batch);
    inserted += batch.length;
  }
  return inserted;
}

// ─────────────────────────────────────────────
// Domain migrations
// ─────────────────────────────────────────────

async function migrateOrganizations(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const sinceClause = since
    ? `where created_at >= '${since}'::timestamptz`
    : "";

  // Migrate organizations
  const orgMap: ColumnMap = {
    id: "id",
    slug: "slug",
    name: "name",
    status: `case when deleted_at is not null then 'deleted' when disabled_at is not null then 'suspended' else 'active' end`,
    plan: "coalesce(plan, 'trial')",
    region: "coalesce(region, 'sg')",
    custom_domain: "custom_domain",
    subdomain: "subdomain",
    created_at: "created_at",
    updated_at: "updated_at",
    deleted_at: "deleted_at",
  };
  const orgInserted = await migrateSimpleTable(
    source,
    target,
    "organizations",
    "organizations",
    orgMap,
    since,
    batchSize,
  );

  // Synthesize org_settings
  const settingsQuery = `
    select
      id as "org_id",
      coalesce(branding, '{}')::jsonb as "branding_json",
      coalesce(features, '{}')::jsonb as "features_json",
      coalesce(data_retention_days, 730) as "data_retention_days",
      'standard' as "pii_policy"
    from organizations
    ${sinceClause}
  `;
  for await (const batch of fetchBatches(source, settingsQuery, batchSize)) {
    await insertBatch(target, "org_settings", ["org_id", "branding_json", "features_json", "data_retention_days", "pii_policy"], batch);
  }

  return orgInserted;
}

async function migrateUsers(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    id: "id",
    email: "email",
    email_verified_at: "email_verified",
    hashed_password: "password_hash",
    totp_secret_enc: "two_factor_secret",
    status: "'active'",
    last_login_at: "null",
    last_login_ip: "null",
    created_at: "created_at",
    updated_at: "updated_at",
  };
  return migrateSimpleTable(source, target, "users", "users", map, since, batchSize);
}

async function migratePlatformAdmins(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    id: "id",
    email: "email",
    hashed_password: "password_hash",
    totp_secret_enc: "two_factor_secret",
    role: `case role when 'ADMIN' then 'ADMIN' when 'SUPER_ADMIN' then 'SUPER_ADMIN' when 'SUPPORT' then 'SUPPORT' else 'ADMIN' end`,
    status: `case when is_active then 'active' else 'deleted' end`,
    last_login_at: "last_login_at",
    created_at: "created_at",
  };
  return migrateSimpleTable(source, target, "platform_admins", "platform_admins", map, since, batchSize);
}

async function migrateMemberships(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    id: "id",
    user_id: "user_id",
    org_id: "org_id",
    role: `case role when 'ADMIN' then 'admin' when 'AGENT' then 'agent' when 'READONLY' then 'analyst' when 'CUSTOMER_ADMIN' then 'end_user' when 'REQUESTER' then 'end_user' when 'VIEWER' then 'end_user' else 'end_user' end`,
    team_id: "null",
    invited_by: "null",
    invited_at: "null",
    accepted_at: "null",
    removed_at: "deactivated_at",
  };
  return migrateSimpleTable(source, target, "memberships", "memberships", map, since, batchSize);
}

async function migrateTickets(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const sinceClause = since
    ? `where created_at >= '${since}'::timestamptz`
    : "";

  // We need to assign sequential numbers per org in JS because target may already have tickets
  const query = `select id, org_id, subject, description, category, status, priority, requester_id, assignee_id, merged_into_id, created_at, updated_at, resolved_at, deleted_at from tickets ${sinceClause} order by org_id, created_at`;

  let inserted = 0;
  let batch: Record<string, unknown>[] = [];
  let currentOrg: string | null = null;
  let nextNumber = 1;

  for await (const rows of fetchBatches(source, query, batchSize)) {
    for (const row of rows) {
      const orgId = row.org_id as string;
      if (orgId !== currentOrg) {
        currentOrg = orgId;
        // Find max existing number for this org in target
        const maxResult = await target.unsafe<{ max: string | null }[]>(
          `select max(number)::text as max from tickets where org_id = $1`,
          [orgId],
        );
        nextNumber = Number(maxResult[0]?.max || 0) + 1;
      }

      const number = nextNumber++;
      const status = String(row.status || "NEW").toUpperCase();
      const priority = String(row.priority || "P3").toUpperCase();
      const category = String(row.category || "INCIDENT").toUpperCase();

      batch.push({
        id: row.id,
        org_id: orgId,
        number,
        key: `${orgId}-${number}`,
        title: row.subject,
        description_md: row.description,
        type:
          { INCIDENT: "incident", REQUEST: "request", PROBLEM: "problem", CHANGE: "change" }[category] ||
          "incident",
        status:
          { NEW: "new", OPEN: "open", IN_PROGRESS: "open", WAITING_ON_CUSTOMER: "pending", RESOLVED: "resolved", CLOSED: "closed", MERGED: "merged" }[status] ||
          "new",
        priority:
          { P1: "p1", P2: "p2", P3: "p3", P4: "p4" }[priority] ||
          "p3",
        source: "portal",
        requester_id: row.requester_id,
        assignee_id: row.assignee_id,
        team_id: null,
        sla_policy_id: null,
        merged_into_id: row.merged_into_id,
        custom_fields_json: {},
        created_at: row.created_at,
        updated_at: row.updated_at,
        resolved_at: row.resolved_at,
        closed_at: null,
        deleted_at: row.deleted_at,
      });

      if (batch.length >= batchSize) {
        await insertBatch(target, "tickets", [
          "id", "org_id", "number", "key", "title", "description_md", "type",
          "status", "priority", "source", "requester_id", "assignee_id",
          "team_id", "sla_policy_id", "merged_into_id", "custom_fields_json",
          "created_at", "updated_at", "resolved_at", "closed_at", "deleted_at",
        ], batch);
        inserted += batch.length;
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    await insertBatch(target, "tickets", [
      "id", "org_id", "number", "key", "title", "description_md", "type",
      "status", "priority", "source", "requester_id", "assignee_id",
      "team_id", "sla_policy_id", "merged_into_id", "custom_fields_json",
      "created_at", "updated_at", "resolved_at", "closed_at", "deleted_at",
    ], batch);
    inserted += batch.length;
  }

  return inserted;
}

async function migrateTicketMessages(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const sinceClause = since
    ? `where c.created_at >= '${since}'::timestamptz`
    : "";
  const query = `
    select
      c.id,
      t.org_id,
      c.ticket_id,
      c.user_id as author_id,
      case when c.platform_admin_id is not null then 'system' when c.user_id is not null then 'user' else 'user' end as author_kind,
      c.content as body_md,
      c.content as body_html_sanitized,
      case when c.is_internal then 'internal' else 'public' end as visibility,
      'portal' as channel,
      c.message_id as email_message_id,
      c.in_reply_to as email_in_reply_to,
      c.created_at,
      c.deleted_at
    from ticket_comments c
    join tickets t on t.id = c.ticket_id
    ${sinceClause}
    order by c.id
  `;

  let inserted = 0;
  for await (const batch of fetchBatches(source, query, batchSize)) {
    await insertBatch(target, "ticket_messages", [
      "id", "org_id", "ticket_id", "author_id", "author_kind", "body_md",
      "body_html_sanitized", "visibility", "channel", "email_message_id",
      "email_in_reply_to", "created_at", "deleted_at",
    ], batch);
    inserted += batch.length;
  }
  return inserted;
}

async function synthesizeTicketEvents(
  target: postgres.Sql,
): Promise<number> {
  // From comments
  await target.unsafe(`
    insert into ticket_events (org_id, ticket_id, actor_id, actor_kind, event_type, payload_json, created_at)
    select
      org_id,
      ticket_id,
      author_id,
      author_kind,
      'comment_added',
      jsonb_build_object('message_id', id, 'migrated', true),
      created_at
    from ticket_messages
    on conflict do nothing
  `);

  // From audit logs (if any were migrated)
  await target.unsafe(`
    insert into ticket_events (org_id, ticket_id, actor_id, actor_kind, event_type, payload_json, created_at)
    select
      org_id,
      resource_id as ticket_id,
      actor_id,
      actor_kind,
      case action
        when 'TICKET_STATUS_CHANGED' then 'status_changed'
        when 'TICKET_ASSIGNED' then 'assignee_changed'
        when 'TICKET_PRIORITY_CHANGED' then 'priority_changed'
        when 'TICKET_CREATED' then 'ticket_created'
        else 'ticket_updated'
      end,
      jsonb_build_object('legacy_action', action, 'migrated', true),
      created_at
    from audit_log
    where resource = 'ticket' and resource_id is not null
    on conflict do nothing
  `);

  const result = await target.unsafe<{ count: string }[]>(
    `select count(*)::text as count from ticket_events`,
  );
  return Number(result[0]?.count || 0);
}

async function migrateTicketAssets(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    ticket_id: "ticket_id",
    asset_id: "asset_id",
  };
  return migrateSimpleTable(source, target, "ticket_assets", "ticket_assets", map, since, batchSize);
}

async function migrateTicketTags(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    id: "id",
    name: "name",
    color: "color",
    created_at: "created_at",
  };
  return migrateSimpleTable(source, target, "ticket_tags", "ticket_tags", map, since, batchSize);
}

async function migrateTicketTagAssignments(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    id: "id",
    ticket_id: "ticket_id",
    tag_id: "tag_id",
    assigned_by_id: "assigned_by_id",
    created_at: "created_at",
  };
  return migrateSimpleTable(source, target, "ticket_tag_assignments", "ticket_tag_assignments", map, since, batchSize);
}

async function migrateTicketMerges(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const sinceClause = since
    ? `where created_at >= '${since}'::timestamptz`
    : "";
  const query = `
    select
      target_ticket_id as "parent_id",
      source_ticket_id as "child_id",
      'duplicate' as "link_type",
      merged_by_id as "created_by",
      created_at
    from ticket_merges
    ${sinceClause}
    order by id
  `;
  let inserted = 0;
  for await (const batch of fetchBatches(source, query, batchSize)) {
    await insertBatch(target, "ticket_links", ["parent_id", "child_id", "link_type", "created_by", "created_at"], batch);
    inserted += batch.length;
  }
  return inserted;
}

async function migrateTicketDependencies(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const sinceClause = since
    ? `where created_at >= '${since}'::timestamptz`
    : "";
  const query = `
    select
      ticket_id as "parent_id",
      depends_on_ticket_id as "child_id",
      case dependency_type
        when 'blocks' then 'blocks'
        when 'blocked_by' then 'blocked_by'
        when 'relates_to' then 'related'
        else 'related'
      end as "link_type",
      created_by_id as "created_by",
      created_at
    from ticket_dependencies
    ${sinceClause}
    order by id
  `;
  let inserted = 0;
  for await (const batch of fetchBatches(source, query, batchSize)) {
    await insertBatch(target, "ticket_links", ["parent_id", "child_id", "link_type", "created_by", "created_at"], batch);
    inserted += batch.length;
  }
  return inserted;
}

async function migrateKbCategories(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    id: "id",
    org_id: "org_id",
    name: "name",
    slug: "slug",
    description: "description",
    parent_id: "parent_id",
    sort_order: "sort_order",
    created_at: "created_at",
    updated_at: "updated_at",
  };
  return migrateSimpleTable(source, target, "kb_categories", "kb_categories", map, since, batchSize);
}

async function migrateKbArticles(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    id: "id",
    org_id: "org_id",
    category_id: "category_id",
    title: "title",
    slug: "slug",
    content: "content",
    excerpt: "excerpt",
    status: `case status when 'draft' then 'draft' when 'pending_review' then 'in_review' when 'published' then 'published' when 'archived' then 'archived' else 'draft' end`,
    visibility: `case visibility when 'public' then 'public' when 'internal' then 'authenticated' when 'agents_only' then 'restricted' when 'org_only' then 'authenticated' else 'authenticated' end`,
    author_id: "author_id",
    approved_by_id: "approved_by_id",
    approved_at: "approved_at",
    published_at: "published_at",
    view_count: "view_count",
    helpful_count: "helpful_count",
    not_helpful_count: "not_helpful_count",
    tags: "coalesce(tags, '{}')",
    created_at: "created_at",
    updated_at: "updated_at",
  };
  return migrateSimpleTable(source, target, "kb_articles", "kb_articles", map, since, batchSize);
}

async function migrateKbVersions(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const sinceClause = since
    ? `where created_at >= '${since}'::timestamptz`
    : "";
  const query = `
    select
      article_id as "article_id",
      title,
      content,
      excerpt,
      created_by_id as "editor_id",
      change_summary as "change_summary",
      created_at
    from kb_article_versions
    ${sinceClause}
    order by id
  `;
  let inserted = 0;
  for await (const batch of fetchBatches(source, query, batchSize)) {
    await insertBatch(target, "kb_revisions", ["article_id", "title", "content", "excerpt", "editor_id", "change_summary", "created_at"], batch);
    inserted += batch.length;
  }
  return inserted;
}

async function migrateKbFeedback(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    id: "id",
    article_id: "article_id",
    user_id: "user_id",
    helpful: "helpful",
    comment: "comment",
    created_at: "created_at",
  };
  return migrateSimpleTable(source, target, "kb_article_feedback", "kb_feedback", map, since, batchSize);
}

async function migrateAssets(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    id: "id",
    org_id: "org_id",
    name: "name",
    type: "coalesce(type, 'OTHER')",
    status: "coalesce(status, 'ACTIVE')",
    hostname: "hostname",
    serial_number: "serial_number",
    model: "model",
    vendor: "vendor",
    ip_address: "ip_address",
    mac_address: "mac_address",
    site_id: "site_id",
    area_id: "area_id",
    parent_asset_id: "null",
    monitoring_external_id: "zabbix_host_id",
    monitoring_enabled: "monitoring_enabled",
    monitoring_status: "monitoring_status",
    last_synced_at: "last_synced_at",
    uptime_percentage: "uptime_percentage",
    access_urls: "access_urls",
    tags: "tags",
    notes: "notes",
    custom_fields_json: "'{}'::jsonb",
    archived: "archived",
    archived_at: "archived_at",
    created_at: "created_at",
    updated_at: "updated_at",
  };
  return migrateSimpleTable(source, target, "assets", "assets", map, since, batchSize);
}

async function migrateAuditLogs(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const sinceClause = since
    ? `where created_at >= '${since}'::timestamptz`
    : "";
  const query = `
    select
      id,
      org_id,
      user_id as "actor_id",
      case
        when platform_admin_id is not null then 'platform_admin'
        when user_id is not null then 'user'
        else 'system'
      end as "actor_kind",
      action::text as "action",
      case
        when action like 'TICKET_%' then 'ticket'
        when action like 'USER_%' then 'user'
        when action like 'ORG_%' then 'org'
        when action like 'MEMBERSHIP_%' then 'membership'
        when action like 'EXPORT_%' then 'export'
        else 'unknown'
      end as "resource",
      ticket_id as "resource_id",
      jsonb_build_object('legacy_details', details) as "details_json",
      ip_address as "ip_address",
      user_agent as "user_agent",
      null as "signature",
      null as "key_id",
      created_at
    from audit_logs
    ${sinceClause}
    order by id
  `;
  let inserted = 0;
  for await (const batch of fetchBatches(source, query, batchSize)) {
    await insertBatch(target, "audit_log", [
      "id", "org_id", "actor_id", "actor_kind", "action", "resource",
      "resource_id", "details_json", "ip_address", "user_agent",
      "signature", "key_id", "created_at",
    ], batch);
    inserted += batch.length;
  }
  return inserted;
}

async function migrateAiAuditLog(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const sinceClause = since
    ? `where created_at >= '${since}'::timestamptz`
    : "";
  const query = `
    select
      id,
      org_id,
      user_id as "user_id",
      md5(user_query) as "request_hash",
      md5(ai_response) as "response_hash",
      system_prompt_hash as "prompt_id",
      model_used as "model",
      tokens_used as "tokens_used",
      response_time_ms as "latency_ms",
      null as "injection_score",
      pii_detected as "pii_redacted",
      jsonb_build_object('legacy_interface', interface, 'sources_used', sources_used) as "metadata_json",
      created_at
    from ai_audit_log
    ${sinceClause}
    order by id
  `;
  let inserted = 0;
  for await (const batch of fetchBatches(source, query, batchSize)) {
    await insertBatch(target, "ai_audit", [
      "id", "org_id", "user_id", "request_hash", "response_hash",
      "prompt_id", "model", "tokens_used", "latency_ms",
      "injection_score", "pii_redacted", "metadata_json", "created_at",
    ], batch);
    inserted += batch.length;
  }
  return inserted;
}

async function migrateAutomations(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const sinceClause = since
    ? `where created_at >= '${since}'::timestamptz`
    : "";
  const query = `
    select
      id,
      org_id,
      name,
      is_enabled as "enabled",
      priority,
      trigger_on::text as "trigger",
      conditions as "conditions_json",
      actions as "actions_json",
      created_by as "created_by",
      created_by_platform_admin as "created_by_platform_admin",
      created_at,
      updated_at
    from automation_rules
    ${sinceClause}
    order by id
  `;
  let inserted = 0;
  for await (const batch of fetchBatches(source, query, batchSize)) {
    await insertBatch(target, "automations", [
      "id", "org_id", "name", "enabled", "priority", "trigger",
      "conditions_json", "actions_json", "created_by",
      "created_by_platform_admin", "created_at", "updated_at",
    ], batch);
    inserted += batch.length;
  }
  return inserted;
}

async function migrateAutomationRuns(
  source: postgres.Sql,
  target: postgres.Sql,
  since?: string,
  batchSize = 1000,
): Promise<number> {
  const map: ColumnMap = {
    id: "id",
    org_id: "org_id",
    automation_id: "rule_id",
    ticket_id: "ticket_id",
    trigger: "trigger::text",
    matched: "matched",
    status: "lower(status)",
    actions_executed: "actions_executed",
    duration_ms: "duration_ms",
    error: "error",
    metadata: "metadata",
    created_at: "created_at",
  };
  return migrateSimpleTable(source, target, "automation_runs", "automation_runs", map, since, batchSize);
}

// ─────────────────────────────────────────────
// Migration spec
// ─────────────────────────────────────────────

const migrations: TableMigration[] = [
  { domain: "orgs", table: "organizations", customMigrate: migrateOrganizations },
  { domain: "orgs", table: "org_settings", sourceTable: "organizations", targetTable: "org_settings" },
  { domain: "users", table: "users", customMigrate: migrateUsers },
  { domain: "users", table: "platform_admins", customMigrate: migratePlatformAdmins },
  { domain: "users", table: "memberships", customMigrate: migrateMemberships },
  { domain: "tickets", table: "tickets", customMigrate: migrateTickets },
  { domain: "tickets", table: "ticket_messages", customMigrate: migrateTicketMessages },
  { domain: "tickets", table: "ticket_events", sourceTable: "ticket_comments", targetTable: "ticket_events", customMigrate: async (_s, target) => synthesizeTicketEvents(target) },
  { domain: "tickets", table: "ticket_assets", customMigrate: migrateTicketAssets },
  { domain: "tickets", table: "ticket_tags", customMigrate: migrateTicketTags },
  { domain: "tickets", table: "ticket_tag_assignments", customMigrate: migrateTicketTagAssignments },
  { domain: "tickets", table: "ticket_links (merges)", sourceTable: "ticket_merges", targetTable: "ticket_links", customMigrate: migrateTicketMerges },
  { domain: "tickets", table: "ticket_links (dependencies)", sourceTable: "ticket_dependencies", targetTable: "ticket_links", customMigrate: migrateTicketDependencies },
  { domain: "kb", table: "kb_categories", customMigrate: migrateKbCategories },
  { domain: "kb", table: "kb_articles", customMigrate: migrateKbArticles },
  { domain: "kb", table: "kb_revisions", customMigrate: migrateKbVersions },
  { domain: "kb", table: "kb_feedback", customMigrate: migrateKbFeedback },
  { domain: "assets", table: "assets", customMigrate: migrateAssets },
  { domain: "audit", table: "audit_log", customMigrate: migrateAuditLogs },
  { domain: "audit", table: "ai_audit", customMigrate: migrateAiAuditLog },
  { domain: "automation", table: "automations", customMigrate: migrateAutomations },
  { domain: "automation", table: "automation_runs", customMigrate: migrateAutomationRuns },
];

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

async function validateTicketStatuses(target: postgres.Sql): Promise<string[]> {
  const errors: string[] = [];
  const rows = await target.unsafe<{ count: string }[]>(`
    select count(*)::text as count from tickets
    where status not in ('new','open','pending','on_hold','resolved','closed','merged')
  `);
  if (Number(rows[0]?.count || 0) > 0) {
    errors.push(`${rows[0].count} tickets have invalid statuses`);
  }
  return errors;
}

async function validateRoleMap(target: postgres.Sql): Promise<string[]> {
  const errors: string[] = [];
  const rows = await target.unsafe<{ count: string }[]>(`
    select count(*)::text as count from memberships
    where role not in ('owner','admin','agent_lead','agent','analyst','end_user')
  `);
  if (Number(rows[0]?.count || 0) > 0) {
    errors.push(`${rows[0].count} memberships have invalid roles`);
  }
  return errors;
}

async function validateMergedTickets(target: postgres.Sql): Promise<string[]> {
  const errors: string[] = [];
  const rows = await target.unsafe<{ count: string }[]>(`
    select count(*)::text as count from tickets
    where status = 'merged' and merged_into_id is null
  `);
  if (Number(rows[0]?.count || 0) > 0) {
    errors.push(`${rows[0].count} merged tickets are missing merged_into_id`);
  }
  return errors;
}

// ─────────────────────────────────────────────
// Report builder
// ─────────────────────────────────────────────

async function buildTableReport(
  mode: Mode,
  source: postgres.Sql,
  target: postgres.Sql,
  spec: TableMigration,
  since?: string,
  batchSize?: number,
): Promise<MigrationTableReport> {
  const validationErrors: string[] = [];
  const sourceTable = spec.sourceTable || spec.table;
  const targetTable = spec.targetTable || spec.table;

  const sourceExists = await tableExists(source, sourceTable);
  const targetExists = await tableExists(target, targetTable);

  if (!sourceExists) validationErrors.push("source table missing");
  if (!targetExists) validationErrors.push("target table missing");

  if (!sourceExists || !targetExists) {
    return {
      domain: spec.domain,
      table: spec.table,
      sourceCount: 0,
      destinationCount: 0,
      skippedCount: 0,
      transformedCount: 0,
      validationErrors,
      sampleIds: [],
    };
  }

  const beforeDestinationCount = await countRows(target, targetTable);
  const sourceCount = await countRows(source, sourceTable);
  let transformedCount = 0;

  if (mode === "run" && spec.customMigrate) {
    try {
      transformedCount = await spec.customMigrate(source, target, since, batchSize);
    } catch (err) {
      validationErrors.push(
        `migration failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const destinationCount = await countRows(target, targetTable);
  const skippedCount =
    mode === "run"
      ? Math.max(0, transformedCount - Math.max(0, destinationCount - beforeDestinationCount))
      : 0;

  if (mode === "validate") {
    if (destinationCount !== sourceCount) {
      validationErrors.push(
        `count mismatch: source=${sourceCount}, destination=${destinationCount}`,
      );
    }
    if (spec.customValidate) {
      validationErrors.push(...(await spec.customValidate(source, target)));
    }
    // Global validations for ticket domain
    if (spec.domain === "tickets" && spec.table === "tickets") {
      validationErrors.push(...(await validateTicketStatuses(target)));
      validationErrors.push(...(await validateMergedTickets(target)));
    }
    if (spec.domain === "users" && spec.table === "memberships") {
      validationErrors.push(...(await validateRoleMap(target)));
    }
  }

  return {
    domain: spec.domain,
    table: spec.table,
    sourceCount,
    destinationCount,
    skippedCount,
    transformedCount,
    validationErrors,
    sampleIds: await sampleIds(source, sourceTable, 5),
  };
}

async function writeReports(
  report: MigrationReport,
  reportDir: string,
): Promise<{ jsonPath: string; markdownPath: string }> {
  const resolvedDir = path.resolve(process.cwd(), reportDir);
  if (!resolvedDir.startsWith(process.cwd())) {
    throw new Error(`Unsafe report directory: ${reportDir}`);
  }
  await fs.mkdir(resolvedDir, { recursive: true });
  const stamp = report.startedAt.replace(/[^0-9T-]/g, "-");
  const SAFE_MODES = new Set(["dry-run", "run", "validate"]);
  const safeMode = SAFE_MODES.has(report.mode) ? report.mode : "unknown";
  const base = path.join(resolvedDir, `${stamp}-${safeMode}`);
  const jsonPath = `${base}.json`;
  const markdownPath = `${base}.md`;
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(markdownPath, renderMigrationMarkdown(report));
  return { jsonPath, markdownPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const source = postgres(options.source, { max: 1 });
  const target = postgres(options.target, { max: 1 });

  try {
    const tables: MigrationTableReport[] = [];
    for (const spec of migrations) {
      tables.push(
        await buildTableReport(
          options.mode,
          source,
          target,
          spec,
          options.since,
          options.batchSize,
        ),
      );
    }

    const report: MigrationReport = {
      mode: options.mode,
      startedAt,
      finishedAt: new Date().toISOString(),
      since: options.since,
      source: options.source,
      target: options.target,
      tables,
    };

    const paths = await writeReports(report, options.reportDir);
    console.log(`Migration ${options.mode} report written:`);
    console.log(`- ${paths.jsonPath}`);
    console.log(`- ${paths.markdownPath}`);

    const errorCount = tables.reduce((sum, t) => sum + t.validationErrors.length, 0);
    if (errorCount > 0) {
      console.error(`\n${errorCount} validation error(s) found.`);
      process.exit(1);
    }
  } finally {
    await source.end({ timeout: 5 });
    await target.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
