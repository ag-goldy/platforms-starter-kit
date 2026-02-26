/**
 * Redis Module - Re-exports for backwards compatibility
 * 
 * New code should import from specific modules:
 * - import { redis } from '@/lib/redis/client';
 * - import { cached, invalidate } from '@/lib/redis/cache';
 * - import { rateLimit } from '@/lib/redis/rate-limit';
 * - import { setPresence, getPresence } from '@/lib/redis/presence';
 * - import { saveDraft, getDraft } from '@/lib/redis/drafts';
 */

// Re-export the Redis client and types
export { redis, redisConfig, type RedisLike } from './redis/client';

// Re-export cache utilities
export {
  cached,
  invalidate,
  invalidatePattern,
  invalidateOrgCaches,
  invalidateKBCaches,
  getCacheStats,
  CACHE_KEYS,
  CACHE_TTL,
} from './redis/cache';

// Re-export rate limiting
export {
  rateLimit,
  rateLimitByIp,
  rateLimitByUser,
  rateLimitByEmail,
  getRateLimitStatus,
  RATE_LIMITS,
  type RateLimitResult,
} from './redis/rate-limit';

// Re-export presence tracking
export {
  setPresence,
  getPresence,
  removePresence,
  getPresenceForTickets,
  getEditor,
  subscribeToPresence,
  type PresenceAction,
  type UserPresence,
} from './redis/presence';

// Re-export drafts
export {
  saveDraft,
  getDraft,
  deleteDraft,
  getAllDraftsForUser,
  getDraftCount,
  getDraftAge,
  type Draft,
} from './redis/drafts';
