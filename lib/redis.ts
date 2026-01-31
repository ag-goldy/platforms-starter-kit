import { Redis } from '@upstash/redis';

type StoredValue = {
  value: unknown;
  expiresAt?: number;
};

export interface RedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
  del(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  mget<T = unknown>(...keys: string[]): Promise<(T | null)[]>;
  lpush(key: string, ...values: string[]): Promise<number>;
  rpop<T = string>(key: string): Promise<T | null>;
  llen(key: string): Promise<number>;
  lrem(key: string, count: number, value: string): Promise<number>;
}

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

const isConfigured = !!(url && token);

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
    const [prefix, suffix] = pattern.split('*');
    return key.startsWith(prefix) && key.endsWith(suffix || '');
  };

  return {
    async get<T = unknown>(key: string) {
      const entry = readEntry(key);
      return (entry?.value as T) ?? null;
    },
    async set(key: string, value: unknown) {
      store.set(key, { value });
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
    async incr(key: string) {
      const entry = readEntry(key);
      const current = Number(entry?.value ?? 0);
      const next = current + 1;
      store.set(key, { value: next, expiresAt: entry?.expiresAt });
      return next;
    },
    async expire(key: string, seconds: number) {
      const entry = readEntry(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      store.set(key, entry);
      return 1;
    },
    async keys(pattern: string) {
      return Array.from(store.keys()).filter((key) =>
        matchPattern(key, pattern)
      );
    },
    async mget<T = unknown>(...keys: string[]) {
      return keys.map((key) => {
        const entry = readEntry(key);
        return (entry?.value as T) ?? null;
      });
    },
    async lpush(key: string, ...values: string[]) {
      const entry = readEntry(key);
      const list = (entry?.value as string[]) || [];
      list.unshift(...values);
      store.set(key, { value: list });
      return list.length;
    },
    async rpop<T = string>(key: string) {
      const entry = readEntry(key);
      const list = (entry?.value as string[]) || [];
      if (list.length === 0) return null;
      const value = list.pop()!;
      store.set(key, { value: list });
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
        // Remove all occurrences
        const filtered = list.filter((v) => {
          if (v === value) {
            removed++;
            return false;
          }
          return true;
        });
        store.set(key, { value: filtered });
      } else if (count > 0) {
        // Remove from left
        const filtered: string[] = [];
        for (const v of list) {
          if (v === value && removed < count) {
            removed++;
          } else {
            filtered.push(v);
          }
        }
        store.set(key, { value: filtered });
      } else {
        // Remove from right (count < 0)
        const filtered: string[] = [];
        const toRemove = Math.abs(count);
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i] === value && removed < toRemove) {
            removed++;
          } else {
            filtered.unshift(list[i]);
          }
        }
        store.set(key, { value: filtered });
      }
      return removed;
    },
  };
}

export const redis: RedisLike = isConfigured
  ? new Redis({ url, token })
  : createMockRedis();

export const isRedisConfigured = isConfigured;
