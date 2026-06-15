import {
  cacheGetWithStats,
  cacheSetWithTags,
  CacheCategory,
  CACHE_TTL_REGISTRY,
  buildCacheKey,
} from "@repo/redis";
import { DatabaseError } from "@/lib/errors/error-classes";

interface WithCacheOptions {
  category: CacheCategory;
  keyParts?: (string | number | undefined)[];
  tags?: string[];
  fallback?: boolean;
}

/**
 * Portal-specific caching wrapper.
 *
 * 1. Builds key via buildCacheKey(category, ...keyParts).
 * 2. Looks up TTL from CACHE_TTL_REGISTRY.
 * 3. On cache hit → returns immediately.
 * 4. On miss → executes fn().
 * 5. DatabaseError from fn → rethrown immediately (not cached).
 * 6. Generic error + fallback === true + stale cache → returns stale value.
 * 7. Redis unreachable → executes fn() directly (graceful degradation).
 */
const activePortalFetches = new Map<string, Promise<any>>();

export async function withCache<T>(
  fn: () => Promise<T>,
  options: WithCacheOptions,
): Promise<T> {
  const { category, keyParts = [], tags, fallback = true } = options;

  const key = buildCacheKey(category, ...keyParts);
  const ttlConfig = CACHE_TTL_REGISTRY[category];

  // Try cache first
  const cached = await cacheGetWithStats<T>(key);
  if (cached.value !== null) {
    return cached.value;
  }

  let activeFetch = activePortalFetches.get(key);
  if (!activeFetch) {
    activeFetch = fn()
      .then(async (result) => {
        await cacheSetWithTags(key, result, ttlConfig.l2Seconds, tags);
        return result;
      })
      .finally(() => {
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
      if (l1Retry.value !== null && l1Retry.source === "l1") {
        return l1Retry.value;
      }
    }

    throw err;
  }
}
