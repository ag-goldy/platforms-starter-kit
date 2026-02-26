/**
 * Redis Client - Supports both Upstash REST API and standard Redis connections
 * 
 * Priority:
 * 1. KV_REST_API_URL + KV_REST_API_TOKEN (Upstash REST API)
 * 2. REDIS_URL (standard Redis connection string)
 * 3. TCKREDIS_REDIS_URL (alternative Redis connection string)
 * 4. Fallback to mock in-memory Redis for development
 */

import { Redis as UpstashRedis } from '@upstash/redis';
import { Redis as IORedis } from 'ioredis';

// Redis-like interface for type safety
export interface RedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number; px?: number }): Promise<string | null>;
  del(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  mget<T = unknown>(...keys: string[]): Promise<(T | null)[]>;
  hset(key: string, field: string, value: unknown): Promise<number>;
  hget<T = unknown>(key: string, field: string): Promise<T | null>;
  hgetall<T = Record<string, unknown>>(key: string): Promise<T>;
  hdel(key: string, field: string): Promise<number>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  lpush(key: string, ...values: string[]): Promise<number>;
  rpop<T = string>(key: string): Promise<T | null>;
  llen(key: string): Promise<number>;
  lrem(key: string, count: number, value: string): Promise<number>;
  lrange<T = string>(key: string, start: number, stop: number): Promise<T[]>;
}

type StoredValue = {
  value: unknown;
  expiresAt?: number;
};

// Check which Redis configuration is available
const upstashUrl = process.env.KV_REST_API_URL;
const upstashToken = process.env.KV_REST_API_TOKEN;
const redisUrl = process.env.REDIS_URL || process.env.TCKREDIS_REDIS_URL;

const isUpstashConfigured = !!(upstashUrl && upstashToken);
const isRedisConfigured = !!redisUrl;

/**
 * Create a mock Redis client for development/testing
 */
function createMockRedis(): RedisLike {
  const store = new Map<string, StoredValue>();

  const readEntry = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  };

  const matchPattern = (key: string, pattern: string) => {
    if (pattern === '*') return true;
    if (!pattern.includes('*')) return key === pattern;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  };

  return {
    async get<T = unknown>(key: string) {
      const entry = readEntry(key);
      return (entry?.value as T) ?? null;
    },
    async set(key: string, value: unknown, opts?: { ex?: number; px?: number }) {
      const ttlMs = opts?.ex ? opts.ex * 1000 : opts?.px;
      store.set(key, { 
        value, 
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined 
      });
      return 'OK';
    },
    async del(key: string) {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    },
    async ttl(key: string) {
      const entry = readEntry(key);
      if (!entry) return -2;
      if (!entry.expiresAt) return -1;
      return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    },
    async expire(key: string, seconds: number) {
      const entry = readEntry(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      store.set(key, entry);
      return 1;
    },
    async incr(key: string) {
      const entry = readEntry(key);
      const current = Number(entry?.value ?? 0);
      const next = current + 1;
      store.set(key, { value: next, expiresAt: entry?.expiresAt });
      return next;
    },
    async decr(key: string) {
      const entry = readEntry(key);
      const current = Number(entry?.value ?? 0);
      const next = current - 1;
      store.set(key, { value: next, expiresAt: entry?.expiresAt });
      return next;
    },
    async keys(pattern: string) {
      return Array.from(store.keys()).filter((key) => matchPattern(key, pattern));
    },
    async mget<T = unknown>(...keys: string[]) {
      return keys.map((key) => {
        const entry = readEntry(key);
        return (entry?.value as T) ?? null;
      });
    },
    async hset(key: string, field: string, value: unknown) {
      const entry = readEntry(key);
      const hash = (entry?.value as Record<string, unknown>) || {};
      hash[field] = value;
      store.set(key, { value: hash, expiresAt: entry?.expiresAt });
      return 1;
    },
    async hget<T = unknown>(key: string, field: string) {
      const entry = readEntry(key);
      const hash = (entry?.value as Record<string, unknown>) || {};
      return (hash[field] as T) ?? null;
    },
    async hgetall<T = Record<string, unknown>>(key: string) {
      const entry = readEntry(key);
      return (entry?.value as T) || ({} as T);
    },
    async hdel(key: string, field: string) {
      const entry = readEntry(key);
      const hash = (entry?.value as Record<string, unknown>) || {};
      const existed = delete hash[field];
      if (existed) {
        store.set(key, { value: hash, expiresAt: entry?.expiresAt });
      }
      return existed ? 1 : 0;
    },
    async hincrby(key: string, field: string, increment: number) {
      const entry = readEntry(key);
      const hash = (entry?.value as Record<string, number>) || {};
      const current = Number(hash[field] ?? 0);
      const next = current + increment;
      hash[field] = next;
      store.set(key, { value: hash, expiresAt: entry?.expiresAt });
      return next;
    },
    async lpush(key: string, ...values: string[]) {
      const entry = readEntry(key);
      const list = (entry?.value as string[]) || [];
      list.unshift(...values);
      store.set(key, { value: list, expiresAt: entry?.expiresAt });
      return list.length;
    },
    async rpop<T = string>(key: string) {
      const entry = readEntry(key);
      const list = (entry?.value as string[]) || [];
      if (list.length === 0) return null;
      const value = list.pop()!;
      store.set(key, { value: list, expiresAt: entry?.expiresAt });
      return value as T;
    },
    async llen(key: string) {
      const entry = readEntry(key);
      const list = (entry?.value as string[]) || [];
      return list.length;
    },
    async lrem(key: string, count: number, value: string) {
      const entry = readEntry(key);
      const list = (entry?.value as string[]) || [];
      let removed = 0;
      if (count === 0) {
        const filtered = list.filter((v) => {
          if (v === value) {
            removed++;
            return false;
          }
          return true;
        });
        store.set(key, { value: filtered, expiresAt: entry?.expiresAt });
      } else if (count > 0) {
        const filtered: string[] = [];
        for (const v of list) {
          if (v === value && removed < count) {
            removed++;
          } else {
            filtered.push(v);
          }
        }
        store.set(key, { value: filtered, expiresAt: entry?.expiresAt });
      } else {
        const filtered: string[] = [];
        const toRemove = Math.abs(count);
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i] === value && removed < toRemove) {
            removed++;
          } else {
            filtered.unshift(list[i]);
          }
        }
        store.set(key, { value: filtered, expiresAt: entry?.expiresAt });
      }
      return removed;
    },
    async lrange<T = string>(key: string, start: number, stop: number) {
      const entry = readEntry(key);
      const list = (entry?.value as string[]) || [];
      return list.slice(start, stop + 1) as T[];
    },
  };
}

/**
 * Wrap Upstash Redis client to match our RedisLike interface
 */
function wrapUpstashClient(client: UpstashRedis): RedisLike {
  return {
    async get<T = unknown>(key: string) {
      const value = await client.get<T>(key);
      return value ?? null;
    },
    async set(key: string, value: unknown, opts?: { ex?: number; px?: number }) {
      if (opts?.ex) {
        return await client.set(key, value, { ex: opts.ex });
      }
      if (opts?.px) {
        return await client.set(key, value, { px: opts.px });
      }
      return await client.set(key, value);
    },
    async del(key: string) {
      return await client.del(key);
    },
    async ttl(key: string) {
      return await client.ttl(key);
    },
    async expire(key: string, seconds: number) {
      return await client.expire(key, seconds);
    },
    async incr(key: string) {
      return await client.incr(key);
    },
    async decr(key: string) {
      return await client.decr(key);
    },
    async keys(pattern: string) {
      return await client.keys(pattern);
    },
    async mget<T = unknown>(...keys: string[]) {
      const values = await client.mget<T[]>(keys);
      return values.map(v => v ?? null);
    },
    async hset(key: string, field: string, value: unknown) {
      return await client.hset(key, { [field]: value });
    },
    async hget<T = unknown>(key: string, field: string) {
      const value = await client.hget<T>(key, field);
      return value ?? null;
    },
    async hgetall<T = Record<string, unknown>>(key: string) {
      return await client.hgetall<T>(key);
    },
    async hdel(key: string, field: string) {
      return await client.hdel(key, field);
    },
    async hincrby(key: string, field: string, increment: number) {
      return await client.hincrby(key, field, increment);
    },
    async lpush(key: string, ...values: string[]) {
      return await client.lpush(key, ...values);
    },
    async rpop<T = string>(key: string) {
      const value = await client.rpop<T>(key);
      return value ?? null;
    },
    async llen(key: string) {
      return await client.llen(key);
    },
    async lrem(key: string, count: number, value: string) {
      return await client.lrem(key, count, value);
    },
    async lrange<T = string>(key: string, start: number, stop: number) {
      return await client.lrange<T[]>(key, start, stop);
    },
  };
}

/**
 * Wrap IORedis client to match our RedisLike interface
 */
function wrapIORedisClient(client: IORedis): RedisLike {
  return {
    async get<T = unknown>(key: string) {
      const value = await client.get(key);
      return value ? JSON.parse(value) as T : null;
    },
    async set(key: string, value: unknown, opts?: { ex?: number; px?: number }) {
      const serialized = JSON.stringify(value);
      if (opts?.ex) {
        return await client.set(key, serialized, 'EX', opts.ex);
      }
      if (opts?.px) {
        return await client.set(key, serialized, 'PX', opts.px);
      }
      return await client.set(key, serialized);
    },
    async del(key: string) {
      return await client.del(key);
    },
    async ttl(key: string) {
      return await client.ttl(key);
    },
    async expire(key: string, seconds: number) {
      return await client.expire(key, seconds);
    },
    async incr(key: string) {
      return await client.incr(key);
    },
    async decr(key: string) {
      return await client.decr(key);
    },
    async keys(pattern: string) {
      return await client.keys(pattern);
    },
    async mget<T = unknown>(...keys: string[]) {
      const values = await client.mget(keys);
      return values.map(v => v ? JSON.parse(v) as T : null);
    },
    async hset(key: string, field: string, value: unknown) {
      return await client.hset(key, field, JSON.stringify(value));
    },
    async hget<T = unknown>(key: string, field: string) {
      const value = await client.hget(key, field);
      return value ? JSON.parse(value) as T : null;
    },
    async hgetall<T = Record<string, unknown>>(key: string) {
      const result = await client.hgetall(key);
      const parsed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(result)) {
        try {
          parsed[k] = JSON.parse(v);
        } catch {
          parsed[k] = v;
        }
      }
      return parsed as T;
    },
    async hdel(key: string, field: string) {
      return await client.hdel(key, field);
    },
    async hincrby(key: string, field: string, increment: number) {
      return await client.hincrby(key, field, increment);
    },
    async lpush(key: string, ...values: string[]) {
      return await client.lpush(key, ...values);
    },
    async rpop<T = string>(key: string) {
      return await client.rpop(key) as T | null;
    },
    async llen(key: string) {
      return await client.llen(key);
    },
    async lrem(key: string, count: number, value: string) {
      return await client.lrem(key, count, value);
    },
    async lrange<T = string>(key: string, start: number, stop: number) {
      return await client.lrange(key, start, stop) as T[];
    },
  };
}

// Create the appropriate Redis client
function createRedisClient(): RedisLike {
  if (isUpstashConfigured) {
    console.log('[Redis] Using Upstash REST API client');
    const upstash = new UpstashRedis({
      url: upstashUrl!,
      token: upstashToken!,
    });
    return wrapUpstashClient(upstash);
  }

  if (isRedisConfigured) {
    console.log('[Redis] Using standard Redis client (IORedis)');
    const ioRedis = new IORedis(redisUrl!, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[Redis] Max retries reached, using mock client');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });
    
    ioRedis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
    
    ioRedis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });
    
    return wrapIORedisClient(ioRedis);
  }

  console.warn('[Redis] No Redis configuration found, using mock client');
  return createMockRedis();
}

// Export singleton client
export const redis = createRedisClient();

// Export configuration status
export const redisConfig = {
  isUpstash: isUpstashConfigured,
  isRedis: isRedisConfigured,
  isMock: !isUpstashConfigured && !isRedisConfigured,
};
