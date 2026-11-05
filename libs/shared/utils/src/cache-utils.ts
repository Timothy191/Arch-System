import { DatabaseError } from '@repo/errors';
import {
  buildCacheKey,
  CACHE_TTL_REGISTRY,
  type CacheCategory,
  cacheGetWithStats,
  cacheSetWithTags,
} from '@repo/redis';

interface WithCacheOptions {
  category: CacheCategory;
  keyParts?: (string | number | undefined)[];
  tags?: string[];
  fallback?: boolean;
  /** When true, cache null/undefined results with a short TTL to prevent cache penetration. */
  allowNegativeCache?: boolean;
  /** TTL in seconds for negative (null/undefined) cache entries. Default: 30s. */
  negativeCacheTtl?: number;
}

/**
 * Portal-specific caching wrapper.
 *
 * 1. Builds key via buildCacheKey(category, ...keyParts).
 * 2. Looks up TTL from CACHE_TTL_REGISTRY.
 * 3. On cache hit (including cached null/negative entries) → returns immediately.
 * 4. On miss → executes fn().
 * 5. DatabaseError from fn → rethrown immediately (not cached).
 * 6. Generic error + fallback === true + stale cache → returns stale value.
 * 7. Redis unreachable → executes fn() directly (graceful degradation).
 * 8. When fn() returns null/undefined and allowNegativeCache is true → caches
 *    the null result with negativeCacheTtl to prevent cache penetration.
 */
const activePortalFetches = new Map<string, Promise<unknown>>();

export async function withCache<T>(fn: () => Promise<T>, options: WithCacheOptions): Promise<T> {
  const {
    category,
    keyParts = [],
    tags,
    fallback = true,
    allowNegativeCache = true,
    negativeCacheTtl = 30,
  } = options;

  const key = buildCacheKey(category, ...keyParts);
  const ttlConfig = CACHE_TTL_REGISTRY[category];

  // Try cache first — serve cached null/negative entries too (source !== null)
  const cached = await cacheGetWithStats<T>(key);
  if (cached.source !== null) {
    return cached.value as T;
  }

  let activeFetch = activePortalFetches.get(key) as Promise<T> | undefined;
  if (!activeFetch) {
    activeFetch = (async () => {
      const result = await fn();

      // Negative-cache null/undefined results to prevent cache penetration
      if (result === null || result === undefined) {
        if (allowNegativeCache) {
          await cacheSetWithTags(key, result as T, negativeCacheTtl, tags);
        }
        // When allowNegativeCache is false, deliberately skip caching nulls
        return result;
      }

      await cacheSetWithTags(key, result, ttlConfig.l2Seconds, tags);
      return result;
    })().finally(() => {
      activePortalFetches.delete(key);
    });
    activePortalFetches.set(key, activeFetch);
  }

  try {
    return await activeFetch;
  } catch (err) {
    // Do not cache DatabaseError — rethrow immediately
    if (err instanceof DatabaseError) {
      throw err;
    }

    // Fallback: if Redis was unreachable on the initial lookup we may have
    // skipped L2. Re-check L1 now (it may have been populated by another
    // request in the meantime), otherwise rethrow.
    if (fallback) {
      const l1Retry = await cacheGetWithStats<T>(key);
      if (l1Retry.source !== null && l1Retry.source === 'l1') {
        return l1Retry.value as T;
      }
    }

    throw err;
  }
}
