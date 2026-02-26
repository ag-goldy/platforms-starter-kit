/**
 * Utility for fetching multiple data sources in parallel
 * Reduces total loading time vs sequential fetching
 */

interface DataFetchConfig<T> {
  key: string;
  fetcher: () => Promise<T>;
}

interface DataResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

/**
 * Fetch multiple data sources in parallel
 */
export async function fetchInParallel<T extends Record<string, unknown>>(
  config: { [K in keyof T]: DataFetchConfig<T[K]> }
): Promise<{ [K in keyof T]: DataResult<T[K]> }> {
  const entries = Object.entries(config) as [keyof T, DataFetchConfig<T[keyof T]>][];
  
  const results = await Promise.allSettled(
    entries.map(async ([key, { fetcher }]) => {
      try {
        const data = await fetcher();
        return { key, data, error: null };
      } catch (error) {
        return { 
          key, 
          data: null, 
          error: error instanceof Error ? error : new Error(String(error)) 
        };
      }
    })
  );
  
  const resultMap = {} as { [K in keyof T]: DataResult<T[K]> };
  
  results.forEach((result, index) => {
    const key = entries[index][0];
    if (result.status === 'fulfilled') {
      resultMap[key] = {
        data: result.value.data as T[typeof key],
        error: result.value.error as Error | null,
        isLoading: false,
      };
    } else {
      resultMap[key] = {
        data: null,
        error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        isLoading: false,
      };
    }
  });
  
  return resultMap;
}

/**
 * Fetch with timeout - prevents hanging requests
 */
export async function fetchWithTimeout<T>(
  fetcher: () => Promise<T>,
  timeoutMs: number = 5000,
  fallback?: T
): Promise<T | undefined> {
  return Promise.race([
    fetcher(),
    new Promise<undefined>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]).catch((error) => {
    console.warn('Fetch timeout or error:', error);
    return fallback;
  });
}
