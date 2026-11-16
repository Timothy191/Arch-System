'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { type ReactNode, useEffect, useState } from 'react';

import {
  createAsyncQueryCachePersister,
  getQueryCacheMetrics,
  inspectPersistedCacheHit,
  purgePersistedQueryCache,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE_MS,
  QUERY_CACHE_STORAGE_KEY,
  QUERY_STALE_TIMES,
  recordCacheRehydrateResult,
  resolveQueryStaleTime,
  shouldPersistQueryKey,
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
            // Keep focus refetch off — pit tablets switch apps constantly and would
            // stampede the API. Reconnect refetch stays on (TanStack default) so
            // stale queries refresh when connectivity returns after offline queue sync.
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            networkMode: 'online',
            retry: DEFAULT_QUERY_RETRY_COUNT,
          },
        },
      })
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const didHitPersistedSnapshot = inspectPersistedCacheHit();
    recordCacheRehydrateResult(didHitPersistedSnapshot);

    const queryCachePersister = createAsyncQueryCachePersister(QUERY_CACHE_STORAGE_KEY);

    const [unsubscribePersist, restorePromise] = persistQueryClient({
      queryClient,
      persister: queryCachePersister,
      buster: QUERY_CACHE_BUSTER,
      maxAge: QUERY_CACHE_MAX_AGE_MS,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          query.state.status === 'success' && shouldPersistQueryKey(query.queryKey),
      },
    });

    void restorePromise;

    const unsubscribeCrossTab = subscribeQueryCacheCrossTab(() => {
      queryClient.clear();
    });

    return () => {
      unsubscribePersist();
      unsubscribeCrossTab();
    };
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
