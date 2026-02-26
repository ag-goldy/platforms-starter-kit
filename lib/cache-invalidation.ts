/**
 * Cache Invalidation Helpers
 * 
 * Centralized cache invalidation for server actions.
 * Import and call these after successful DB mutations.
 */

import { 
  invalidate, 
  invalidateOrgCaches, 
  invalidateKBCaches,
  CACHE_KEYS 
} from '@/lib/redis/cache';

/**
 * Invalidate org settings cache
 * Call after: org settings update, branding changes
 */
export async function invalidateOrgSettings(orgId: string): Promise<void> {
  await invalidate(CACHE_KEYS.orgSettings(orgId));
  console.log(`[Cache] Invalidated org settings for ${orgId}`);
}

/**
 * Invalidate SLA policies cache
 * Call after: SLA policy create/update/delete
 */
export async function invalidateSLAPolicies(orgId: string): Promise<void> {
  await invalidate(CACHE_KEYS.orgSLA(orgId));
  console.log(`[Cache] Invalidated SLA policies for ${orgId}`);
}

/**
 * Invalidate KB articles cache
 * Call after: article publish/update/delete
 */
export async function invalidateKBArticles(orgId: string): Promise<void> {
  await invalidate(CACHE_KEYS.kbArticles(orgId));
  console.log(`[Cache] Invalidated KB articles for ${orgId}`);
}

/**
 * Invalidate KB categories cache
 * Call after: category create/update/delete
 */
export async function invalidateKBCategories(orgId: string): Promise<void> {
  await invalidate(CACHE_KEYS.kbCategories(orgId));
  console.log(`[Cache] Invalidated KB categories for ${orgId}`);
}

/**
 * Invalidate all KB caches
 * Call after: major KB restructuring
 */
export async function invalidateAllKB(orgId: string): Promise<void> {
  await invalidateKBCaches(orgId);
  console.log(`[Cache] Invalidated all KB caches for ${orgId}`);
}

/**
 * Invalidate status summary cache
 * Call after: ticket create/update/close, service status change
 */
export async function invalidateStatusSummary(orgId: string): Promise<void> {
  await invalidate(CACHE_KEYS.statusSummary(orgId));
  console.log(`[Cache] Invalidated status summary for ${orgId}`);
}

/**
 * Invalidate Zabbix service status
 * Call after: Zabbix sync completion
 */
export async function invalidateZabbixStatus(hostId: string): Promise<void> {
  await invalidate(CACHE_KEYS.zabbixStatus(hostId));
  console.log(`[Cache] Invalidated Zabbix status for ${hostId}`);
}

/**
 * Invalidate user session
 * Call after: user logout, password change, security settings update
 */
export async function invalidateUserSession(userId: string): Promise<void> {
  await invalidate(CACHE_KEYS.userSession(userId));
  console.log(`[Cache] Invalidated session for user ${userId}`);
}

/**
 * Invalidate multiple caches for an organization
 * Call after: major org changes
 */
export async function invalidateOrgAll(orgId: string): Promise<void> {
  await invalidateOrgCaches(orgId);
  await invalidateKBCaches(orgId);
  await invalidateStatusSummary(orgId);
  console.log(`[Cache] Invalidated all caches for org ${orgId}`);
}

/**
 * Wrapper for actions that automatically invalidates cache on success
 * 
 * Usage:
 * ```ts
 * export const updateOrgAction = withCacheInvalidation(
 *   async (orgId, data) => { ... },
 *   (orgId) => invalidateOrgSettings(orgId)
 * );
 * ```
 */
export function withCacheInvalidation<T extends unknown[], R>(
  action: (...args: T) => Promise<R>,
  invalidator: (...args: T) => Promise<void>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const result = await action(...args);
    
    // Invalidate cache after successful action
    // Fire and forget - don't block on cache invalidation
    invalidator(...args).catch(err => {
      console.warn('[Cache] Invalidation failed:', err);
    });
    
    return result;
  };
}
