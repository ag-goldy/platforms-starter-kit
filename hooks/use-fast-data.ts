'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFastDataOptions<T> {
  initialData?: T;
  ttlMs?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface UseFastDataResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isStale: boolean;
}

// Simple in-memory cache for client-side
const cache = new Map<string, { data: unknown; timestamp: number }>();

/**
 * Fast data fetching hook with client-side caching
 * Similar to SWR but lightweight and built-in
 */
export function useFastData<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseFastDataOptions<T> = {}
): UseFastDataResult<T> {
  const { initialData, ttlMs = 60000, enabled = true, onError } = options;
  
  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  
  const refetch = useCallback(async () => {
    if (!key) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetcherRef.current();
      setData(result);
      cache.set(key, { data: result, timestamp: Date.now() });
      setIsStale(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [key, onError]);
  
  useEffect(() => {
    if (!enabled || !key) return;
    
    // Check cache first
    const cached = cache.get(key);
    const now = Date.now();
    
    if (cached && now - cached.timestamp < ttlMs) {
      setData(cached.data as T);
      setIsStale(false);
      
      // Background refetch if data is getting old (75% of TTL)
      if (now - cached.timestamp > ttlMs * 0.75) {
        setIsStale(true);
        refetch();
      }
    } else {
      refetch();
    }
    
    // Set up interval for background refresh
    const interval = setInterval(() => {
      const current = cache.get(key);
      if (current && Date.now() - current.timestamp > ttlMs) {
        setIsStale(true);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [key, enabled, ttlMs, refetch]);
  
  return {
    data,
    isLoading,
    error,
    refetch,
    isStale,
  };
}

/**
 * Hook for prefetching data
 */
export function usePrefetch<T>(key: string, fetcher: () => Promise<T>) {
  const prefetch = useCallback(async () => {
    if (cache.has(key)) return;
    
    try {
      const data = await fetcher();
      cache.set(key, { data, timestamp: Date.now() });
    } catch (err) {
      console.warn('Prefetch failed:', err);
    }
  }, [key, fetcher]);
  
  return prefetch;
}

/**
 * Clear specific cache entry or all cache
 */
export function clearFastDataCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
