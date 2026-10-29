'use client';

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { type ReactNode, useEffect, useState } from 'react';

import {
  getQueryCacheMetrics,
  inspectPersistedCacheHit,
  purgePersistedQueryCache,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE_MS,
  QUERY_CACHE_STORAGE_KEY,
  QUERY_STALE_TIMES,
  recordCacheRehydrateResult,
  resolveQueryStaleTime,
  subscribeQueryCacheCrossTab,
} from '@/lib/query-cache';

export {
  getQueryCacheMetrics,
  purgePersistedQueryCache,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE_MS,
  QUERY_STALE_TIMES,
  resolveQueryStaleTime,
};

const DEFAULT_QUERY_RETRY_COUNT = 2;

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: (query) => resolveQueryStaleTime(query.queryKey),
            gcTime: QUERY_STALE_TIMES.defaultGcTimeMs,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: DEFAULT_QUERY_RETRY_COUNT,
          },
        },
      })
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const didHitPersistedSnapshot = inspectPersistedCacheHit();
    recordCacheRehydrateResult(didHitPersistedSnapshot);

    const storagePersister = createSyncStoragePersister({
      storage: window.localStorage,
      key: QUERY_CACHE_STORAGE_KEY,
    });

    const [, restorePromise] = persistQueryClient({
      queryClient,
      persister: storagePersister,
      buster: QUERY_CACHE_BUSTER,
      maxAge: QUERY_CACHE_MAX_AGE_MS,
    });

    void restorePromise;

    const unsubscribeCrossTab = subscribeQueryCacheCrossTab(() => {
      queryClient.clear();
    });

    return () => {
      unsubscribeCrossTab();
    };
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
