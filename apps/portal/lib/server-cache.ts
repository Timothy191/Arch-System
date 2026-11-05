import { cacheInvalidateTags } from '@repo/redis';
import { revalidateTag as nextRevalidateTag, unstable_cache } from 'next/cache';
import {
  CACHE_TAGS,
  type CanonicalCacheTag,
  scopedTag,
  tagAuthUser,
  tagDepartment,
  tagTable,
  tagTenant,
} from '@/lib/cache-tags';
import { logError } from '@/lib/errors/error-logger';

export {
  CACHE_TAGS,
  type CanonicalCacheTag,
  scopedTag,
  tagAuthUser,
  tagDepartment,
  tagTable,
  tagTenant,
};

/**
 * Standard Next.js 16 semantic cache lifetime profiles.
 * These profiles are used with cacheLife() function in 'use cache' directives.
 */
export const cacheProfiles = {
  // Short-lived: Telemetry data that updates frequently
  telemetry: { stale: 10, revalidate: 10, expire: 60 },

  // Medium-lived: Department data that changes occasionally
  departments: { stale: 300, revalidate: 3600, expire: 86400 },

  // Short-lived: Reports that need frequent updates
  reports: { stale: 60, revalidate: 300, expire: 3600 },

  // Long-lived: Static or rarely changing data
  max: { stale: 300, revalidate: 3600, expire: 86400 },

  // Medium-lived: Hourly updates
  hours: { stale: 60, revalidate: 3600, expire: 86400 },

  // Short-lived: Minute-level updates
  minutes: { stale: 10, revalidate: 60, expire: 300 },

  // Ultra-short: Real-time or near real-time data
  realtime: { stale: 5, revalidate: 15, expire: 60 },

  // Default profile for uncategorized data
  default: { stale: 5, revalidate: 15, expire: 30 },
} as const;

export type CacheProfile = keyof typeof cacheProfiles;

/**
 * Server Action read-your-writes cache updater.
 * Invalidates Next.js Data Cache in the active request and asynchronously
 * purges distributed L1/L2 Redis cache entries associated with the tag.
 *
 * @param tag The cache tag to update
 */
export async function updateTag(tag: string): Promise<void> {
  // 1. Next.js Data Cache invalidation (read-your-writes)
  try {
    const nextCache = require('next/cache');
    if (typeof nextCache.updateTag === 'function') {
      nextCache.updateTag(tag);
    } else {
      nextRevalidateTag(tag, cacheProfiles.max);
    }
  } catch (err) {
    // Outside request context (e.g. standalone tests)
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'server-cache.updateTag.nextjs',
      tag,
    });
  }

  // 2. Distributed L1/L2 Redis cache purge
  try {
    await cacheInvalidateTags([tag]);
  } catch (err) {
    // Gracefully handle Redis offline
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'server-cache.updateTag.redis',
      tag,
    });
  }
}

/**
 * Bulk invalidate multiple cache tags across Next.js and Redis.
 *
 * @param tags Array of cache tags to invalidate
 */
export async function updateTags(tags: string[]): Promise<void> {
  for (const tag of tags) {
    try {
      const nextCache = require('next/cache');
      if (typeof nextCache.updateTag === 'function') {
        nextCache.updateTag(tag);
      } else {
        nextRevalidateTag(tag, cacheProfiles.max);
      }
    } catch (err) {
      // Outside request context
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: 'server-cache.updateTags.nextjs',
        tag,
      });
    }
  }

  try {
    await cacheInvalidateTags(tags);
  } catch (err) {
    // Gracefully handle Redis offline
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'server-cache.updateTags.redis',
      tags,
    });
  }
}

/**
 * Revalidates a cache tag using Next.js 16 SWR revalidation with a profile.
 * Replaces the deprecated single-argument revalidateTag(tag).
 *
 * @param tag The cache tag to invalidate
 * @param profile The cache life profile ('max', 'hours', 'minutes', etc.)
 */
export function refreshTag(tag: string, profile: CacheProfile = 'max'): void {
  const config = cacheProfiles[profile] ?? cacheProfiles.default;
  nextRevalidateTag(tag, config);
}

/**
 * Route Handler (`app/api/.../route.ts`) SWR cache revalidator.
 * Triggers Next.js 16 stale-while-revalidate `revalidateTag(tag, profile)` and
 * purges distributed L1/L2 Redis cache entries associated with the tag.
 *
 * @param tag The cache tag to revalidate
 * @param profile The Next.js 16 cacheLife profile (defaults to 'max')
 */
export async function revalidateTagInRouteHandler(
  tag: string,
  profile: CacheProfile = 'max'
): Promise<void> {
  try {
    refreshTag(tag, profile);
  } catch (err) {
    // Outside Next.js request context
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'server-cache.revalidateTagInRouteHandler.refresh',
      tag,
      profile,
    });
  }

  try {
    await cacheInvalidateTags([tag]);
  } catch (err) {
    // Gracefully handle Redis offline
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'server-cache.revalidateTagInRouteHandler.redis',
      tag,
    });
  }
}

/**
 * Server Action (`'use server'`) dynamic data refresher.
 * Calls Next.js 16 `refresh()` from `next/cache` to re-render uncached dynamic
 * RSC slices on the active page in the same HTTP round-trip without invalidating
 * surrounding cached static shells.
 */
export function refreshAction(): void {
  try {
    const nextCache = require('next/cache') as { refresh?: () => void };
    if (typeof nextCache.refresh === 'function') {
      nextCache.refresh();
    }
  } catch (err) {
    // Outside Server Action request context
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'server-cache.refreshAction',
    });
  }
}

// Backward-compatible aliases
export const revalidateTagWithProfile = refreshTag;
export const updateTagInAction = updateTag;

/**
 * Next.js 16 cacheTag function for tagging cache entries.
 * Used with 'use cache' directive to enable on-demand revalidation.
 *
 * @param tag The cache tag to associate with this cache entry
 */
export function cacheTag(tag: string): void {
  // Next.js 16 cacheTag is available in next/cache
  try {
    const { cacheTag: nextCacheTag } = require('next/cache') as typeof import('next/cache');
    if (typeof nextCacheTag === 'function') {
      nextCacheTag(tag);
    }
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'server-cache.cacheTag',
      tag,
    });
  }
}

/**
 * Next.js 16 cacheLife function for setting cache lifetime profiles.
 * Used with 'use cache' directive to control stale, revalidate, and expire times.
 *
 * @param profile The cache profile name or explicit configuration
 */
export function cacheLife(
  profile: CacheProfile | { stale?: number; revalidate?: number; expire?: number }
): void {
  const { cacheLife: nextCacheLife } = require('next/cache') as typeof import('next/cache');
  if (typeof nextCacheLife !== 'function') {
    return;
  }

  try {
    if (typeof profile === 'string') {
      const config = cacheProfiles[profile];
      if (config) {
        nextCacheLife(config);
      } else {
        nextCacheLife(cacheProfiles.default);
      }
    } else {
      nextCacheLife(profile);
    }
  } catch (err) {
    logError(err instanceof Error ? err : new Error(String(err)), {
      context: 'server-cache.cacheLife',
      profile: typeof profile === 'string' ? profile : 'object',
    });
  }
}

/**
 * Next.js Data Cache wrapper for React Server Component reads.
 * Supports tags-based revalidation via revalidateTag(tag, profile).
 * Kept for incremental migration from unstable_cache to "use cache".
 *
 * @deprecated Use 'use cache' directive with cacheTag and cacheLife instead
 * @param keyParts Unique cache keys to distinguish data queries
 * @param fn The async fetch operation to execute and cache
 * @param options Cache parameters including revalidate TTL and tags
 */
export function cachedRSC<T>(
  keyParts: string[],
  fn: () => Promise<T>,
  options?: {
    revalidate?: number | false;
    tags?: string[];
  }
): Promise<T> {
  return unstable_cache(fn, keyParts, {
    revalidate: options?.revalidate,
    tags: options?.tags,
  })();
}
