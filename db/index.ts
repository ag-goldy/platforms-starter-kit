/**
 * Database Connection
 * 
 * Supports two drivers:
 * 1. @neondatabase/serverless (default) - Optimized for serverless/edge environments
 * 2. postgres-js - Traditional PostgreSQL driver
 * 
 * Use DB_DRIVER=neon (default) or DB_DRIVER=postgres in environment
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import postgres from 'postgres';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// Determine which driver to use
const DRIVER = process.env.DB_DRIVER || 'neon';
const useNeon = DRIVER === 'neon';

// Type for the database client
type DbClient = PostgresJsDatabase<typeof schema> | NeonHttpDatabase<typeof schema>;

// Singleton instances
let postgresClient: postgres.Sql | null = null;
let neonClient: ReturnType<typeof neon> | null = null;
let dbInstance: DbClient | null = null;

/**
 * Get database URL from environment
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
}

/**
 * Create postgres-js client
 */
function createPostgresClient(): postgres.Sql {
  const url = getDatabaseUrl();
  
  return postgres(url, {
    max: 10, // Connection pool size
    idle_timeout: 20, // Close idle connections after 20s
    connect_timeout: 10, // Connection timeout
    prepare: false, // Disable prepared statements for compatibility
  });
}

/**
 * Create Neon serverless client
 */
function createNeonClient(): ReturnType<typeof neon> {
  const url = getDatabaseUrl();
  return neon(url);
}

/**
 * Get or create the database client
 */
function getDbClient(): DbClient {
  if (dbInstance) {
    return dbInstance;
  }
  
  if (useNeon) {
    // Use Neon serverless driver
    if (!neonClient) {
      neonClient = createNeonClient();
      console.log('[DB] Using Neon serverless driver');
    }
    dbInstance = drizzleNeon(neonClient, { schema });
  } else {
    // Use postgres-js driver
    if (!postgresClient) {
      postgresClient = createPostgresClient();
      console.log('[DB] Using postgres-js driver');
    }
    dbInstance = drizzle(postgresClient, { schema });
  }
  
  return dbInstance;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDbClient();
    // Simple query to test connection
    const result = await db.execute('SELECT 1 as test');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[DB] Connection test failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Close database connections (for graceful shutdown)
 */
export async function closeConnection(): Promise<void> {
  if (postgresClient) {
    await postgresClient.end();
    postgresClient = null;
    console.log('[DB] postgres-js connection closed');
  }
  // Neon client doesn't need explicit closing
  neonClient = null;
  dbInstance = null;
}

/**
 * Get current connection info
 */
export function getConnectionInfo(): {
  driver: string;
  configured: boolean;
} {
  return {
    driver: useNeon ? 'neon' : 'postgres-js',
    configured: !!process.env.DATABASE_URL,
  };
}

// Export the database client as a Proxy for lazy initialization
export const db = new Proxy({} as DbClient, {
  get(_target, prop) {
    return getDbClient()[prop as keyof DbClient];
  },
});

// Re-export schema for convenience
export { schema };
