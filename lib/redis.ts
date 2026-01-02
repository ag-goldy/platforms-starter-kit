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
  };
}

export const redis: RedisLike = isConfigured
  ? new Redis({ url, token })
  : createMockRedis();

export const isRedisConfigured = isConfigured;
