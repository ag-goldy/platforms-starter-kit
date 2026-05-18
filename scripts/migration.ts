import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import {
  renderMigrationMarkdown,
  type MigrationReport,
  type MigrationTableReport,
} from "@/lib/migration/report";

type Mode = MigrationReport["mode"];

interface TableSpec {
  domain: string;
  table: string;
}

interface CliOptions {
  mode: Mode;
  source: string;
  target: string;
  since?: string;
  reportDir: string;
  sampleLimit: number;
}

const tableSpecs: TableSpec[] = [
  { domain: "orgs", table: "organizations" },
  { domain: "users", table: "users" },
  { domain: "users", table: "memberships" },
  { domain: "users", table: "user_invitations" },
  { domain: "tickets", table: "tickets" },
  { domain: "tickets", table: "ticket_comments" },
  { domain: "tickets", table: "ticket_assets" },
  { domain: "tickets", table: "ticket_tags" },
  { domain: "tickets", table: "ticket_tag_assignments" },
  { domain: "tickets", table: "ticket_merges" },
  { domain: "tickets", table: "ticket_dependencies" },
  { domain: "kb", table: "kb_categories" },
  { domain: "kb", table: "kb_articles" },
  { domain: "kb", table: "kb_article_versions" },
  { domain: "kb", table: "kb_article_feedback" },
  { domain: "assets", table: "assets" },
  { domain: "assets", table: "org_asset_types" },
  { domain: "assets", table: "org_asset_statuses" },
  { domain: "audit", table: "audit_logs" },
  { domain: "audit", table: "ai_audit_log" },
];

function usage(exitCode = 1): never {
  console.error(`Usage:
  pnpm migration:dry-run -- --source <url> --target <url>
  pnpm migration:run -- --source <url> --target <url> [--since <timestamp>]
  pnpm migration:validate -- --source <url> --target <url>

Options:
  --source <url>       Source Postgres URL
  --target <url>       Target Postgres URL
  --since <timestamp>  Optional incremental lower bound for run mode
  --report-dir <dir>   Report output directory (default: migration-reports)
  --sample-limit <n>   Sample ID count per table (default: 5)`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]): CliOptions {
  const [rawMode, ...rawRest] = argv;
  const rest = rawRest.filter((arg) => arg !== "--");
  if (!rawMode || !["dry-run", "run", "validate"].includes(rawMode)) usage();

  const options: Partial<CliOptions> = {
    mode: rawMode as Mode,
    reportDir: "migration-reports",
    sampleLimit: 5,
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
    else if (key === "--sample-limit") options.sampleLimit = Number(value);
    else usage();

    index += 1;
  }

  if (!options.source || !options.target) usage();
  if (!Number.isFinite(options.sampleLimit) || options.sampleLimit! < 1)
    usage();

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

async function getColumns(sql: postgres.Sql, table: string): Promise<string[]> {
  const rows = await sql<{ column_name: string }[]>`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
    order by ordinal_position
  `;
  return rows.map((row) => row.column_name);
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
  const columns = await getColumns(sql, table);
  if (!columns.includes("id")) return [];
  const rows = await sql.unsafe<{ id: string }[]>(
    `select id::text as id from ${quoteIdent(table)} order by id limit $1`,
    [limit],
  );
  return rows.map((row) => row.id);
}

async function copyTable(
  source: postgres.Sql,
  target: postgres.Sql,
  table: string,
): Promise<number> {
  const columns = await getColumns(source, table);
  if (columns.length === 0) return 0;

  const selected = await source.unsafe<Record<string, unknown>[]>(
    `select * from ${quoteIdent(table)}`,
  );
  if (selected.length === 0) return 0;

  const quotedColumns = columns.map(quoteIdent).join(", ");
  let inserted = 0;
  const batchSize = 250;

  for (let offset = 0; offset < selected.length; offset += batchSize) {
    const batch = selected.slice(offset, offset + batchSize);
    const values = batch.flatMap((row) => columns.map((column) => row[column]));
    await target.unsafe(
      `insert into ${quoteIdent(table)} (${quotedColumns}) values ${placeholders(batch.length, columns.length)} on conflict do nothing`,
      values,
    );
    inserted += batch.length;
  }

  return inserted;
}

async function validateLifecycle(sql: postgres.Sql): Promise<string[]> {
  const errors: string[] = [];
  const invalidStatusRows = await sql<{ count: string }[]>`
    select count(*)::text as count
    from tickets
    where status not in ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED', 'MERGED')
  `;
  if (Number(invalidStatusRows[0]?.count || 0) > 0) {
    errors.push(`${invalidStatusRows[0].count} tickets have unknown statuses`);
  }

  const badMergeRows = await sql<{ count: string }[]>`
    select count(*)::text as count
    from tickets
    where status = 'MERGED' and merged_into_id is null
  `;
  if (Number(badMergeRows[0]?.count || 0) > 0) {
    errors.push(
      `${badMergeRows[0].count} merged tickets are missing merged_into_id`,
    );
  }

  return errors;
}

async function buildTableReport(
  mode: Mode,
  source: postgres.Sql,
  target: postgres.Sql,
  spec: TableSpec,
  sampleLimit: number,
): Promise<MigrationTableReport> {
  const validationErrors: string[] = [];
  const sourceExists = await tableExists(source, spec.table);
  const targetExists = await tableExists(target, spec.table);

  if (!sourceExists) validationErrors.push("source table missing");
  if (!targetExists) validationErrors.push("target table missing");

  if (!sourceExists || !targetExists) {
    return {
      ...spec,
      sourceCount: 0,
      destinationCount: 0,
      skippedCount: 0,
      transformedCount: 0,
      validationErrors,
      sampleIds: [],
    };
  }

  const beforeDestinationCount = await countRows(target, spec.table);
  const sourceCount = await countRows(source, spec.table);
  let transformedCount = 0;

  if (mode === "run") {
    transformedCount = await copyTable(source, target, spec.table);
  }

  const destinationCount = await countRows(target, spec.table);
  const skippedCount =
    mode === "run"
      ? Math.max(
          0,
          transformedCount -
            Math.max(0, destinationCount - beforeDestinationCount),
        )
      : beforeDestinationCount;

  if (mode === "validate" && destinationCount !== sourceCount) {
    validationErrors.push(
      `count mismatch: source=${sourceCount}, destination=${destinationCount}`,
    );
  }

  return {
    ...spec,
    sourceCount,
    destinationCount,
    skippedCount,
    transformedCount,
    validationErrors,
    sampleIds: await sampleIds(source, spec.table, sampleLimit),
  };
}

async function writeReports(
  report: MigrationReport,
  reportDir: string,
): Promise<{ jsonPath: string; markdownPath: string }> {
  // Prevent path traversal: resolve against cwd and reject any escaping path
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
    for (const spec of tableSpecs) {
      tables.push(
        await buildTableReport(
          options.mode,
          source,
          target,
          spec,
          options.sampleLimit,
        ),
      );
    }

    if (options.mode === "validate" && (await tableExists(target, "tickets"))) {
      const lifecycleErrors = await validateLifecycle(target);
      if (lifecycleErrors.length > 0) {
        const ticketReport = tables.find((table) => table.table === "tickets");
        ticketReport?.validationErrors.push(...lifecycleErrors);
      }
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
  } finally {
    await source.end({ timeout: 5 });
    await target.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
