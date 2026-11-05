# Revalidation

## 1. cacheTag() + cacheLife() tag cache entries for on-demand revalidation

- Source: <https://nextjs.org/docs/app/guides/how-revalidation-works>
- Rule: `'use cache'` functions call `cacheTag(tag)` to associate a cache entry and `cacheLife(profile)` to set stale/revalidate/expire. Tags are the unit of invalidation; soft tags (`_N_T_<path>`) are generated automatically per route segment.

## 2. updateTag() in Server Actions invalidates after a write

- Source: <https://nextjs.org/docs/app/guides/how-revalidation-works>
- Rule: A Server Action that mutates data calls `updateTag(tag)` (via `lib/server-cache.ts` `updateTag`/`updateTags`) before any `redirect()`, so the Next.js Data Cache and Redis L1/L2 are purged together and the next read is fresh.

## 3. revalidateTag(tag, profile) / revalidatePath() for on-demand invalidation

- Source: <https://nextjs.org/docs/app/guides/how-revalidation-works>
- Rule: Use `revalidateTag(tag, 'max')` for immediate freshness, `revalidateTag(tag, { expire: 0 })` for immediate expiration, or `revalidatePath(path)` to invalidate an entire route and its ancestor layout soft tags. Never rely on per-instance local invalidation alone in multi-instance deployments.

## 4. Canonical tags live in lib/cache-tags.ts

- Source: repo layering + `@repo/contract` single-source-of-truth principle
- Rule: All cache tag identifiers are centralized in `apps/portal/lib/cache-tags.ts` (`CACHE_TAGS` registry + `scopedTag`/`tagTenant`/`tagDepartment`/`tagTable`/`tagAuthUser` builders). Route Handlers and Server Actions import from there, never inline tag strings.

## 5. Dual-tier invalidation: Next.js Data Cache + Redis L1/L2

- Source: repo dual-tier cache architecture
- Rule: Every invalidation purges both the Next.js Data Cache (`updateTag`/`revalidateTag`) and the distributed Redis L1/L2 cache (`cacheInvalidateTags`), gracefully degrading when Redis is offline.
