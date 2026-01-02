import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let client: postgres.Sql | null = null;
type DbClient = PostgresJsDatabase<typeof schema>;
let dbInstance: DbClient | null = null;

function getDbClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  if (!client) {
    client = postgres(process.env.DATABASE_URL);
  }
  
  return client;
}

function getDb(): DbClient {
  if (!dbInstance) {
    const dbClient = getDbClient();
    dbInstance = drizzle<typeof schema>(dbClient, { schema });
  }
  
  return dbInstance;
}

export const db = new Proxy({} as DbClient, {
  get(_target, prop) {
    return getDb()[prop as keyof DbClient];
  },
});
