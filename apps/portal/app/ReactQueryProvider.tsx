'use client';

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { type ReactNode, useEffect, useState } from 'react';

// The cache schema version. Bump whenever the persisted snapshot shape changes
// (new column joins, different filter shapes, etc.) so old caches are dropped
// and the new session starts with an empty cache rather than inheriting stale data.
export const QUERY_CACHE_BUSTER = 'portal-v1';

// Old persisted data older than 24h should be discarded on rehydrate.
export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Drop any persisted snapshot before the next user hydrates on a shared
 * control-room terminal. Safe to call repeatedly; if localStorage is disabled
 * the no-op path silently does nothing.
 */
export function purgePersistedQueryCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('arch-portal-query-cache');
  } catch {
    // Storage unavailable — nothing to purge.
  }
}

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 2,
          },
        },
      })
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storagePersister = createSyncStoragePersister({
      storage: window.localStorage,
    });

    // Salt the persisted snapshot with the cache buster version. The buster
    // string forces cache invalidation when the schema changes (bump
    // QUERY_CACHE_BUSTER) so old caches are not hydrated into the new session.
    const persistBuster = QUERY_CACHE_BUSTER;

    const persistClient = persistQueryClient({
      queryClient,
      persister: storagePersister,
      buster: persistBuster,
      // Bounding the persisted cache age prevents stale data from a prior
      // operator leaking into a new session on a shared control-room terminal.
      maxAge: QUERY_CACHE_MAX_AGE_MS,
    });

    // The persistClient is kept alive for the component lifecycle; the
    // persister automatically hydrates/dehydrates on mount/unmount.
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
