import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'drizzle');
const JOURNAL_PATH = path.join(MIGRATIONS_DIR, 'meta', '_journal.json');
const MALFORMED_MIGRATION_ROW_ID = 20;

const TARGET_TAGS = [
  '023_add_zabbix_to_services',
  '024_add_asset_archive',
  '025_fix_asset_type_enum',
  '026_custom_asset_types_statuses',
  '027_advanced_features',
  '0015_ticket_prefix_and_composite_unique',
] as const;

type JournalEntry = {
  idx: number;
  tag: string;
  when: number;
};

type ReconcileMigration = {
  tag: string;
  hash: string;
  createdAt: number;
};

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function readJournalEntries(): JournalEntry[] {
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8')) as {
    entries: JournalEntry[];
  };
  return journal.entries;
}

function computeMigrationHash(tag: string) {
  const filePath = path.join(MIGRATIONS_DIR, `${tag}.sql`);
  const sql = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(sql).digest('hex');
}

function buildTargets() {
  const journalEntries = readJournalEntries();

  return TARGET_TAGS.map((tag): ReconcileMigration => {
    const entry = journalEntries.find((item) => item.tag === tag);

    if (!entry) {
      throw new Error(`Missing journal entry for ${tag}`);
    }

    return {
      tag,
      hash: computeMigrationHash(tag),
      createdAt: entry.when,
    };
  });
}

function buildSqlStatements(targets: ReconcileMigration[]) {
  return [
    `DELETE FROM drizzle.__drizzle_migrations WHERE id = ${MALFORMED_MIGRATION_ROW_ID};`,
    ...targets.map(
      (target) =>
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${sqlString(
          target.hash,
        )}, ${target.createdAt});`,
    ),
  ];
}

async function executeStatements(statements: string[]) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to execute reconciliation');
  }

  const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: 'require' });

  try {
    await db.begin(async (tx) => {
      for (const statement of statements) {
        await tx.unsafe(statement);
      }
    });
  } finally {
    await db.end();
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';
  const targets = buildTargets();
  const statements = buildSqlStatements(targets);

  console.log('Drizzle journal reconciliation targets:');
  for (const target of targets) {
    console.log(`${target.tag}\t${target.hash}\t${target.createdAt}`);
  }

  console.log('');
  console.log('SQL statements:');
  for (const statement of statements) {
    console.log(statement);
  }

  if (dryRun) {
    console.log('');
    console.log('DRY_RUN=true; no statements executed.');
    return;
  }

  await executeStatements(statements);
  console.log('');
  console.log('Reconciliation complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
