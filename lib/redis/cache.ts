/**
 * Generic Cache Utility Layer
 * 
 * Provides:
 * - cached<T>() - Wrapper for cache-aside pattern with TTL
 * - invalidate() - Remove specific key from cache
 * - invalidatePattern() - Remove keys matching pattern
 * 
 * All Redis operations have try/catch - failures fall through to DB
 */

import { redis } from './client';

// Cache key prefixes for different data types
export const CACHE_KEYS = {
  orgSettings: (orgId: string) => `org:${orgId}:settings`,
  orgSLA: (orgId: string) => `org:${orgId}:sla`,
  kbArticles: (orgId: string) => `kb:${orgId}:articles`,
  kbCategories: (orgId: string) => `kb:${orgId}:categories`,
  statusSummary: (orgId: string) => `status:${orgId}:summary`,
  zabbixStatus: (hostId: string) => `zabbix:${hostId}:status`,
  userSession: (userId: string) => `session:${userId}:valid`,
} as const;

// Default TTLs in seconds
export const CACHE_TTL = {
  orgSettings: 3600,      // 1 hour
  orgSLA: 3600,           // 1 hour
  kbArticles: 1800,       // 30 minutes
  kbCategories: 1800,     // 30 minutes
  statusSummary: 300,     // 5 minutes
  zabbixStatus: 300,      // 5 minutes
  userSession: 900,       // 15 minutes
} as const;

/**
 * Generic cache wrapper with TTL
 * Implements cache-aside pattern: check cache first, fall through to DB on miss
 * 
 * @param key - Redis cache key
 * @param ttlSeconds - Time to live in seconds
 * @param fetcher - Function to fetch data from DB on cache miss
 * @returns Cached or freshly fetched data
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    // Try to get from cache first
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      return cached;
    }
  } catch (error) {
    // Redis failure - log and continue to DB
    console.warn(`[Cache] Failed to get key "${key}":`, error);
  }

  // Cache miss or Redis failure - fetch from DB
  const data = await fetcher();

  // Try to cache the result (fire and forget - don't block on Redis)
  try {
    await redis.set(key, data, { ex: ttlSeconds });
  } catch (error) {
    console.warn(`[Cache] Failed to set key "${key}":`, error);
  }

  return data;
}

/**
 * Invalidate a specific cache key
 * 
 * @param key - Redis key to delete
 */
export async function invalidate(key: string): Promise<void> {
  try {
    await redis.del(key);
    console.log(`[Cache] Invalidated key: ${key}`);
  } catch (error) {
    console.warn(`[Cache] Failed to invalidate key "${key}":`, error);
  }
}

/**
 * Invalidate all keys matching a pattern
 * Uses Redis KEYS command - use sparingly in production
 * 
 * @param pattern - Redis key pattern (e.g., "org:abc123:*")
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      // Delete keys one by one since we don't have multi-key DEL wrapper
      for (const key of keys) {
        await redis.del(key);
      }
      console.log(`[Cache] Invalidated ${keys.length} keys matching: ${pattern}`);
    }
  } catch (error) {
    console.warn(`[Cache] Failed to invalidate pattern "${pattern}":`, error);
  }
}

/**
 * Helper to invalidate organization-related caches
 * Useful when org settings change
 */
export async function invalidateOrgCaches(orgId: string): Promise<void> {
  await Promise.all([
    invalidate(CACHE_KEYS.orgSettings(orgId)),
    invalidate(CACHE_KEYS.orgSLA(orgId)),
    invalidate(CACHE_KEYS.statusSummary(orgId)),
  ]);
}

/**
 * Helper to invalidate KB-related caches
 */
export async function invalidateKBCaches(orgId: string): Promise<void> {
  await Promise.all([
    invalidate(CACHE_KEYS.kbArticles(orgId)),
    invalidate(CACHE_KEYS.kbCategories(orgId)),
  ]);
}

/**
 * Get cache statistics (for monitoring)
 * Note: This is approximate and may be slow on large Redis instances
 */
export async function getCacheStats(): Promise<{
  totalKeys: number;
  orgKeys: number;
  kbKeys: number;
  statusKeys: number;
  sessionKeys: number;
}> {
  try {
    const allKeys = await redis.keys('*');
    return {
      totalKeys: allKeys.length,
      orgKeys: allKeys.filter(k => k.startsWith('org:')).length,
      kbKeys: allKeys.filter(k => k.startsWith('kb:')).length,
      statusKeys: allKeys.filter(k => k.startsWith('status:')).length,
      sessionKeys: allKeys.filter(k => k.startsWith('session:')).length,
    };
  } catch (error) {
    console.error('[Cache] Failed to get stats:', error);
    return {
      totalKeys: 0,
      orgKeys: 0,
      kbKeys: 0,
      statusKeys: 0,
      sessionKeys: 0,
    };
  }
}
