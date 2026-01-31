import { beforeEach } from 'vitest';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

beforeEach(async () => {
  if (!process.env.DATABASE_URL) {
    return;
  }

  await db.execute(sql.raw('SET client_min_messages TO WARNING;'));
  await db.execute(
    sql.raw('TRUNCATE TABLE organizations, users CASCADE;')
  );
});
