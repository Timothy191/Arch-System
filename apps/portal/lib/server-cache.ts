import { cacheInvalidateTags } from '@repo/redis';
import { revalidateTag as nextRevalidateTag, unstable_cache } from 'next/cache';

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
 * Helper to build a generic scoped cache tag.
 */
export function scopedTag(scope: string, id: string): string {
  return `${scope}:${id}`;
}

/**
 * Helper to build a tenant-scoped cache tag (prevents cross-tenant leaks).
 */
export function tagTenant(tenantId: string, resource: string): string {
  return `tenant:${tenantId}:${resource}`;
}

/**
 * Helper to build a department-scoped cache tag.
 */
export function tagDepartment(departmentSlug: string, resource: string): string {
  return `dept:${departmentSlug}:${resource}`;
}

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
      (nextRevalidateTag as any)(tag, 'max');
    }
  } catch {
    // Outside request context (e.g. standalone tests)
  }

  // 2. Distributed L1/L2 Redis cache purge
  try {
    await cacheInvalidateTags([tag]);
  } catch {
    // Gracefully handle Redis offline
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
        (nextRevalidateTag as any)(tag, 'max');
      }
    } catch {
      // Outside request context
    }
  }

  try {
    await cacheInvalidateTags(tags);
  } catch {
    // Gracefully handle Redis offline
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
  (nextRevalidateTag as any)(tag, profile);
}

// Backward-compatible alias
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
  const { cacheTag: nextCacheTag } = require('next/cache') as typeof import('next/cache');
  if (typeof nextCacheTag === 'function') {
    nextCacheTag(tag);
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
