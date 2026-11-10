# Caching Consolidation: Follow-Up Items F–K

**System:** Arch-System Caching Layer (`@repo/redis`, `apps/portal`, `libs/shared/utils`, `libs/shared/hooks`)  
**Document:** Technical Specification — Follow-Up Items  
**Status:** DONE (2026-11-10)  
**Date:** 2026-11-02  
**Related:** `docs/plans/2026-11-02-caching-consolidation/spec.md` (items A–E, completed)

---

## 1. Objective

Complete the remaining caching layer improvements identified in the original recommendations but deferred from items A–E:

- **(F)** Migrate off deprecated `cachedRSC`/`unstable_cache` to Next.js 16 `'use cache'` + `cacheTag`/`cacheLife` pattern.
- **(G)** Rename/rework `useRedisCache` which is client-only and never touches Redis — misleading name.
- **(H)** Add negative-cache support in `withCache` for cached `null`/`undefined` values (cache penetration defense).
- **(I)** Reduce silent error swallowing in invalidation paths — log errors instead of empty `catch {}`.
- **(J)** Consolidate `redisCircuitBreaker` usage across the Redis cache layer (currently isolated in `adaptive.ts`).
- **(K)** Expand unit/integration test coverage for L1/L2 hit paths in `@repo/redis` and `withCache`.

---

## 2. Scope

### In scope

| File                                                 | Change                                                                                                                 | Item |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---- |
| `apps/portal/app/hub/page.tsx`                       | Replace `cachedRSC` calls with `'use cache'` + `cacheLife` + `cacheTag`                                                | F    |
| `apps/portal/app/hub/executive/page.tsx`             | Replace `cachedRSC` call with `'use cache'` + `cacheLife` + `cacheTag`                                                 | F    |
| `apps/portal/lib/hub-departments.ts`                 | Replace `cachedRSC` calls with `'use cache'` + `cacheLife` + `cacheTag`                                                | F    |
| `apps/portal/lib/tools.ts`                           | Replace `cachedRSC` call with `'use cache'` + `cacheLife` + `cacheTag`                                                 | F    |
| `apps/portal/app/(departments)/engineering/page.tsx` | Remove unused `cachedRSC` import                                                                                       | F    |
| `apps/portal/app/(departments)/drilling/page.tsx`    | Remove unused `cachedRSC` import                                                                                       | F    |
| `libs/shared/hooks/src/useRedisCache.ts`             | Rename primary export to `useClientCache`, keep `useRedisCache` as deprecated alias, document client-only semantics    | G    |
| `libs/shared/hooks/src/index.ts`                     | Export `useClientCache`; keep `useRedisCache` re-export                                                                | G    |
| `libs/shared/utils/src/cache-utils.ts`               | Add `allowNegativeCache`/`negativeCacheTtl` options; fix null hit check to use `source !== null`                       | H    |
| `apps/portal/lib/server-cache.ts`                    | Log errors in Redis-related catch blocks instead of silent `catch {}`                                                  | I    |
| `packages/redis/src/invalidation.ts`                 | Log errors in catch blocks instead of silent `catch {}`                                                                | I    |
| `packages/redis/src/cache.ts`                        | Wire `redisCircuitBreaker` into `getRedisClientSafe()` and Redis ops (record success/failure, short-circuit when open) | J    |
| `packages/redis/src/adaptive.ts`                     | Ensure `redisCircuitBreaker` is properly exported and usable by cache layer                                            | J    |
| `packages/redis/tests/cache.test.ts`                 | Add L1 hit, L2 hit, miss, null/negative cache tests                                                                    | K    |
| `packages/redis/tests/l1.test.ts`                    | Add tests for null/falsey value presence distinction                                                                   | K    |
| `apps/portal/lib/cache-utils.test.ts`                | Add negative-cache tests for `withCache`                                                                               | K    |
| Test files importing `cachedRSC` mocks               | Remove `cachedRSC` mocks (no longer imported by pages)                                                                 | F    |

### Out of scope

- No changes to `@repo/redis` core L1/L2 data structures beyond circuit-breaker wiring
- No changes to migration files or database schema
- No changes to `next.config.mjs` `cacheLife` (already reconciled in items A–E)
- No new dependencies

---

## 3. Acceptance Criteria

1. **`cachedRSC` eliminated**: No production code imports `cachedRSC` from `@/lib/server-cache`; all four call sites use `'use cache'` + `cacheLife` + `cacheTag`.
2. **`useClientCache` available**: `import { useClientCache } from '@repo/shared/hooks'` type-checks; `useRedisCache` remains as deprecated alias.
3. **Negative caching works**: `withCache` returns cached `null` on hit (source `'l1'`/`'l2'`), caches `null` results with configurable short TTL.
4. **Errors logged, not swallowed**: Redis invalidation catch blocks in `server-cache.ts` and `invalidation.ts` log errors via `@repo/logger`.
5. **Circuit breaker wired**: `getRedisClientSafe()` short-circuits when `redisCircuitBreaker.isOpen()`; Redis failures trip the breaker.
6. **Test coverage**: New tests pass for L1/L2 hit paths, negative caching, and `withCache` null handling.
7. **Gates pass**: `pnpm type-check`, `pnpm --filter portal type-check`, `pnpm --filter @repo/redis type-check`, `pnpm lint`, `pnpm --filter @repo/redis test`, `pnpm --filter portal test`, `node tools/audits/audit-caching.cjs`, `pnpm policy:check` all pass.

---

## 4. Constraints

- **Layering**: `apps/*` must not import `packages/database`; no `@repo/*` → `apps/*` dependency inversion.
- **Conventional Commits** enforced via `config/tools/commitlint.config.mjs`.
- **Strict TypeScript**: no `any`, no `@ts-ignore`.
- **Biome formatting**: 2-space indent, 100 columns, single quotes, semicolons.
- **No behavior change to L1/L2 TTL values** beyond adding negative-cache TTL option.
- **Server Action template**: never `redirect()` before cache invalidation (not applicable here).

---

## 5. Risks

| Risk                                                           | Mitigation                                                                              | Rollback                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| `'use cache'` migration changes RSC cache key derivation       | Next.js derives cache key from function args — same semantic as `cachedRSC` keyParts    | Re-add `cachedRSC` wrapper                    |
| `useClientCache` rename breaks existing imports                | Keep `useRedisCache` as deprecated alias re-exported alongside                          | Revert rename, keep only `useRedisCache`      |
| Negative caching returns stale `null` for too long             | Default `negativeCacheTtl` = 30s; configurable per-call                                 | Set `allowNegativeCache: false`               |
| Circuit breaker short-circuits Redis during transient failures | Breaker auto-transitions to HALF_OPEN after cooldown; failures are isolated per-process | Remove circuit-breaker wiring from `cache.ts` |
| Error logging adds overhead to hot invalidation paths          | Log only in catch blocks (error paths, not hot paths)                                   | Revert to silent catch                        |
| Concurrent session conflict on shared files                    | Files are mostly disjoint; `cache-utils.ts` and `server-cache.ts` have clear ownership  | N/A                                           |

---

## 6. References

- `apps/portal/lib/server-cache.ts` — `cachedRSC` definition (line 219), `cacheLife`, `cacheTag`
- `apps/portal/app/hub/page.tsx` lines 40, 82 — `cachedRSC` usages
- `apps/portal/app/hub/executive/page.tsx` line 80 — `cachedRSC` usage
- `apps/portal/lib/hub-departments.ts` lines 31, 74, 114 — `cachedRSC` usages
- `apps/portal/lib/tools.ts` line 32 — `cachedRSC` usage
- `libs/shared/hooks/src/useRedisCache.ts` — client-only hook, misleading name
- `libs/shared/utils/src/cache-utils.ts` — `withCache` with `cached.value !== null` check (blocks null caching)
- `packages/redis/src/cache.ts` — `getRedisClientSafe()`, `cacheGet`, `cacheSet` with silent catches
- `packages/redis/src/invalidation.ts` — `cacheInvalidateTags`, `cacheInvalidatePrefixes` with silent catches
- `packages/redis/src/adaptive.ts` — `redisCircuitBreaker` singleton, only used by `swrCacheWrap`
- `packages/redis/tests/cache.test.ts` — existing Redis cache tests
- `packages/redis/tests/l1.test.ts` — existing L1 tests
- `apps/portal/lib/cache-utils.test.ts` — existing `withCache` tests
