/**
 * Client-side TanStack Query persistence policy.
 *
 * Shared because three places must agree on it: the provider that persists,
 * the sign-out listener that clears, and the auth layout that purges before a
 * different operator can hydrate the cache on a shared control-room terminal.
 */
export const QUERY_CACHE_STORAGE_KEY = 'arch-portal-query-cache';

/** Bump whenever a persisted query shape changes; old caches are then dropped. */
export const QUERY_CACHE_BUSTER = 'portal-v1';

/** Persisted snapshots older than a day are discarded on rehydrate. */
export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Drop the persisted cache. Safe to call repeatedly and in any environment:
 * private browsing and disabled storage both throw on access.
 */
export function purgePersistedQueryCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing to purge.
  }
}
