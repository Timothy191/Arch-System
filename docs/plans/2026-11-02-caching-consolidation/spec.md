# Caching Consolidation: Correctness Fixes + Docs Alignment

**System:** Arch-System Caching Layer (`@repo/redis`, `apps/portal`, `libs/shared/utils`, `libs/shared/hooks`)  
**Document:** Technical Specification  
**Status:** Ready for Implementation  
**Date:** 2026-11-02  
**Related:** `docs/plans/2026-10-29-redis-optimization-report.md`, `.agents/rules/redis-capabilities.md`

---

## 1. Objective

Correct caching correctness defects and align documentation with code so the dual-tier (L1 memory + L2 Redis) cache, the Next.js Data Cache (`'use cache'` / `unstable_cache`), and the client-side cache behave predictably, without silent data-staleness or redundant invalidation.

Specifically:

- **(A)** Reconcile `cacheLife` profiles declared in `next.config.mjs` with the canonical `cacheProfiles` SSoT in `apps/portal/lib/server-cache.ts` so `'use cache'` directives and the programmatic `cacheLife()` helper agree.
- **(B)** Eliminate double Next.js invalidation in `revalidateRSC` (`apps/portal/app/actions.ts`) which calls `updateTag(tag)` then `updateTagInAction(tag)` (the latter already calls `nextCache.updateTag(tag)`).
- **(C)** Fix `refreshTag` to pass a resolved `{stale, revalidate, expire}` config object to `revalidateTag(tag, cacheLife)` instead of a profile-name string hidden behind `as any`.
- **(D)** Align docs: `cacheGetOrSet` is referenced across AGENTS.md and docs but the package exports only `cacheWrap`.
- **(E)** Align docs: `.agents/rules/redis-capabilities.md` states `MAX_L1_TTL_SECONDS = 60`; code and AGENT_TRACER confirm it was raised to 300 on 2026-10-29.

Out of scope (follow-up work, tracked separately):

- Migration off deprecated `cachedRSC`/`unstable_cache` to `'use cache'` + `cacheTag`/`cacheLife` (F)
- Renaming/reworking `useRedisCache` which is client-only and never touches Redis (G)
- Negative-cache support in `withCache` for cached `null` values (H)
- Reduced silent error swallowing in invalidation paths (I)
- Circuit-breaker consolidation (J)
- Expanded unit/integration test coverage for L1/L2 hit paths (K)

---

## 2. Scope

In scope:

| File                                                          | Change                                                                                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/portal/lib/server-cache.ts`                             | Make `cacheProfiles` the single source of truth; add a helper to export resolved profiles; update `cacheLife()` to use it directly; fix `refreshTag` to pass config object |
| `apps/portal/next.config.mjs`                                 | Derive `cacheLife` profiles from `server-cache.ts` `cacheProfiles` (or mirror exactly) so `telemetry`, `reports`, `max`, `default` agree                                   |
| `apps/portal/app/actions.ts`                                  | Replace `updateTag(tag)` + `updateTagInAction(tag)` double call with single `updateTags(tags)` call                                                                        |
| `.agents/rules/redis-capabilities.md`                         | Update `MAX_L1_TTL_SECONDS` from 60 to 300                                                                                                                                 |
| AGENTS.md / docs referencing `cacheGetOrSet`                  | Add `cacheGetOrSet` alias export to `@repo/redis` (`cache.ts` + `index.ts`) or update docs to `cacheWrap`                                                                  |
| `packages/redis/src/cache.ts` + `packages/redis/src/index.ts` | Export `cacheGetOrSet` as alias of `cacheWrap` (preferred, keeps docs valid)                                                                                               |

Out of scope: F–K listed above; no new dependencies; no behavior change to L1/L2 TTL values; no changes to `@repo/redis` core cache logic beyond the `cacheGetOrSet` alias.

---

## 3. Acceptance Criteria

1. **No value drift**: `cacheProfiles` in `server-cache.ts` and `cacheLife` in `next.config.mjs` produce identical `{stale, revalidate, expire}` for `telemetry`, `departments`, `reports`, `hours`, `minutes`, `realtime`.
2. **`default` and `max` profiles exist in both layers**: `next.config.mjs` `cacheLife` includes `max` and `default` matching `server-cache.ts`.
3. **Single invalidation**: `revalidateRSC` calls `updateTags(tags)` once per invocation; no direct `next/cache` `updateTag` call remains in `actions.ts`.
4. **`refreshTag` passes config object**: `revalidateTag(tag, configObject)` is called with a `{stale, revalidate, expire}` object, not a profile-name string.
5. **`cacheGetOrSet` resolves**: `import { cacheGetOrSet } from '@repo/redis'` type-checks and is an alias of `cacheWrap`.
6. **Rule doc corrected**: `.agents/rules/redis-capabilities.md` states `MAX_L1_TTL_SECONDS = 300`.
7. **Gates pass**: `pnpm type-check`, `pnpm --filter portal type-check`, `pnpm --filter @repo/redis type-check`, `pnpm lint`, `pnpm --filter @repo/redis test`, `node tools/audits/audit-caching.cjs`, `pnpm policy:check` all pass.
8. **No regressions**: unrelated caching behavior (XFetch early-expiry, tag invalidation, session fencing) unchanged — existing `@repo/redis` tests still pass.

---

## 4. Constraints

- **Layering (machine-enforced via `tools/repo/policy-compiler.cjs`)**: `apps/*` must not import `packages/database`; route through `@repo/supabase`. `packages/ui` must not import `packages/database`/`packages/supabase`. No `@repo/*` → `apps/*` dependency inversion.
- **Conventional Commits** (`config/tools/commitlint.config.mjs`).
- **Strict TypeScript**: no `any`, no `@ts-ignore` (the existing `as any` casts in `refreshTag` and `nextRevalidateTag` usages must be resolved or minimized).
- **Immutable migrations**: no migration changes in this scope.
- **Server Action template**: never `redirect()` before cache invalidation (not applicable here, but keep in mind).
- **Biome formatting**: 2-space indent, 100 columns, single quotes, semicolons.
- **No `any`**: resolve `as any` casts where feasible.

---

## 5. Risks

| Risk                                                                         | Mitigation                                                                                               | Rollback                                         |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `cacheLife` profile values change `'use cache'` TTL semantics in production  | Keep values identical to current `server-cache.ts` SSoT; verify via audit tool                           | Revert `next.config.mjs` `cacheLife` block       |
| `revalidateRSC` behavior change breaks callers expecting double invalidation | Double invalidation is pure waste (idempotent Next.js invalidation); single call is sufficient           | Re-add `updateTag` call (documented as wasteful) |
| `refreshTag` config-object change alters revalidation semantics              | Resolve `cacheProfiles[profile]`; object shape matches Next.js 16 `cacheLife` type                       | Revert to `as any` string pass-through           |
| `cacheGetOrSet` alias conflicts with future naming                           | Export as explicit alias of `cacheWrap`, documented                                                      | Remove alias, update docs to `cacheWrap`         |
| Concurrent session conflict on shared files                                  | Files are disjoint (`server-cache.ts`, `next.config.mjs`, `actions.ts`, rule doc, `cache.ts`/`index.ts`) | N/A — no overlap                                 |

---

## References

- `apps/portal/lib/server-cache.ts` — canonical cache SSoT
- `apps/portal/next.config.mjs` lines 170-201 — `cacheLife` profiles
- `apps/portal/app/actions.ts` lines 68-94 — `revalidateRSC` double invalidation
- `packages/redis/src/cache.ts` — `cacheWrap` implementation
- `packages/redis/src/index.ts` — barrel exports
- `.agents/rules/redis-capabilities.md` — stale `MAX_L1_TTL_SECONDS = 60` rule
- `tools/audits/audit-caching.cjs` — caching auditor (presence checks only)
