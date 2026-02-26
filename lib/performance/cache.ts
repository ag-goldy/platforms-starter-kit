/**
 * Simple in-memory cache for server-side data fetching
 * Use with caution - only for data that doesn't change frequently
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached data or fetch fresh data
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 60000 // 1 minute default
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);
  
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }
  
  const data = await fetcher();
  cache.set(key, {
    data,
    expiresAt: now + ttlMs,
  });
  
  return data;
}

/**
 * Invalidate cache entry
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate cache entries matching pattern
 */
export function invalidateCachePattern(pattern: RegExp): void {
  for (const key of cache.keys()) {
    if (pattern.test(key)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.clear();
}
