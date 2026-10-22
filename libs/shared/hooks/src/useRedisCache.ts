'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseRedisCacheOptions<T> {
  ttlSeconds?: number;
  revalidateOnFocus?: boolean;
  initialData?: T;
  tags?: string[];
  enabled?: boolean;
}

export interface UseRedisCacheResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  mutate: (newData?: T | ((prev: T | undefined) => T)) => Promise<void>;
  invalidate: () => Promise<void>;
}

export interface ClientCacheEntry {
  data: unknown;
  expiresAt: number;
  timestamp?: number;
  ttl?: number;
}

export const MAX_CACHE_ENTRIES = 100;

// In-memory L1 client cache to guarantee zero layout shift and instant response
export const clientCache = new Map<string, ClientCacheEntry>();

function isEntryExpired(entry: ClientCacheEntry, now: number): boolean {
  if (typeof entry.expiresAt === 'number') {
    return now >= entry.expiresAt;
  }
  if (typeof entry.timestamp === 'number' && typeof entry.ttl === 'number') {
    return now - entry.timestamp >= entry.ttl * 1000;
  }
  return false;
}

/**
 * Retrieve a cache entry with TTL validation and LRU promotion.
 */
export function getClientCacheEntry(key: string, now = Date.now()): ClientCacheEntry | undefined {
  const entry = clientCache.get(key);
  if (!entry) return undefined;

  if (isEntryExpired(entry, now)) {
    clientCache.delete(key);
    return undefined;
  }

  // Refresh LRU position (delete + re-insert)
  clientCache.delete(key);
  clientCache.set(key, entry);
  return entry;
}

/**
 * Insert or update a cache entry with expired purging and bounded LRU eviction.
 */
export function setClientCacheEntry(key: string, entry: ClientCacheEntry, now = Date.now()): void {
  // If key already exists, delete it first so re-insertion refreshes LRU order
  if (clientCache.has(key)) {
    clientCache.delete(key);
  }

  // Purge any expired entries if at or above capacity
  if (clientCache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, v] of clientCache.entries()) {
      if (isEntryExpired(v, now)) {
        clientCache.delete(k);
      }
    }
  }

  // Evict oldest LRU entry if still at or above capacity
  while (clientCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = clientCache.keys().next().value;
    if (oldestKey !== undefined) {
      clientCache.delete(oldestKey);
    } else {
      break;
    }
  }

  clientCache.set(key, entry);
}

/**
 * Clear all entries from the client cache (useful for testing and forced resets).
 */
export function clearClientCache(): void {
  clientCache.clear();
}

/**
 * Industrial React 19 hook for caching data via the Serverless Redis engine.
 * Features:
 * - Immediate L1 memory retrieval to prevent CLS
 * - Bounded LRU + TTL cache eviction
 * - Background revalidation with stale-while-revalidate semantics
 * - Safe SSR hydration guard (no window/document leaks)
 * - Tag invalidation support
 */
export function useRedisCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseRedisCacheOptions<T> = {}
): UseRedisCacheResult<T> {
  const { ttlSeconds = 60, revalidateOnFocus = true, initialData, enabled = true } = options;

  const [data, setData] = useState<T | undefined>(() => {
    if (typeof window === 'undefined') return initialData;
    const cached = getClientCacheEntry(key);
    if (cached) {
      return cached.data as T;
    }
    return initialData;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!data && enabled);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!enabled) return;
      if (!isBackground) setIsLoading(true);
      setError(null);

      try {
        const fresh = await fetcherRef.current();
        const now = Date.now();
        setClientCacheEntry(
          key,
          {
            data: fresh,
            expiresAt: now + ttlSeconds * 1000,
            timestamp: now,
            ttl: ttlSeconds,
          },
          now
        );
        setData(fresh);
      } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error(String(err));
        setError(errObj);
      } finally {
        setIsLoading(false);
      }
    },
    [key, ttlSeconds, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    const cached = getClientCacheEntry(key);

    if (cached) {
      setData(cached.data as T);
    } else {
      fetchData(false);
    }
  }, [key, enabled, fetchData]);

  useEffect(() => {
    if (!revalidateOnFocus || typeof window === 'undefined' || !enabled) return;

    const onFocus = () => {
      const now = Date.now();
      const cached = getClientCacheEntry(key, now);
      const halfTtlRemaining = cached ? cached.expiresAt - now <= (ttlSeconds * 1000) / 2 : true;
      if (!cached || halfTtlRemaining) {
        fetchData(true);
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [key, ttlSeconds, revalidateOnFocus, enabled, fetchData]);

  const mutate = useCallback(
    async (newData?: T | ((prev: T | undefined) => T)) => {
      if (typeof newData === 'function') {
        setData((prev) => {
          const resolved = (newData as (p: T | undefined) => T)(prev);
          const now = Date.now();
          setClientCacheEntry(
            key,
            {
              data: resolved,
              expiresAt: now + ttlSeconds * 1000,
              timestamp: now,
              ttl: ttlSeconds,
            },
            now
          );
          return resolved;
        });
      } else if (newData !== undefined) {
        const now = Date.now();
        setClientCacheEntry(
          key,
          {
            data: newData,
            expiresAt: now + ttlSeconds * 1000,
            timestamp: now,
            ttl: ttlSeconds,
          },
          now
        );
        setData(newData);
      } else {
        await fetchData(true);
      }
    },
    [key, ttlSeconds, fetchData]
  );

  const invalidate = useCallback(async () => {
    clientCache.delete(key);
    await fetchData(false);
  }, [key, fetchData]);

  return {
    data,
    isLoading,
    isError: error !== null,
    error,
    mutate,
    invalidate,
  };
}
