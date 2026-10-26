---
name: next16-cache-tags
description: Apply Arch-System's Next.js 16 server-cache and tag-invalidation conventions. Use when writing or editing a Server Action, route handler, or cached read touching departments/access/delay/telemetry data, or when audit:caching flags a missing invalidation. Covers cacheProfiles, scopedTag/tagTenant/tagDepartment, updateTag, and the revalidateTag/updateTag API names this version actually accepts.
---

# Next 16 Cache Tags

Next 16 changed these APIs; training-data forms fail here. Read `apps/portal/node_modules/next/dist/docs/` (`cacheTag.md`, `revalidateTag.md`, `updateTag.md`, `cacheLife.md`) before writing cache code.

## 1. API names this version accepts

| Form                               | Status in this Next                                |
| ---------------------------------- | -------------------------------------------------- |
| `cacheTag(...)` / `cacheLife(...)` | stable — import from `next/cache`                  |
| `unstable_cacheTag(...)`           | deprecated                                         |
| `revalidateTag(tag, profile)`      | required 2-arg form                                |
| `revalidateTag(tag)`               | deprecated single-arg                              |
| `updateTag(tag)`                   | **Server Actions only** — throws in route handlers |

In a route handler use `revalidateTag(tag, 'max')` (or `{ expire: 0 }`) instead of `updateTag`. `cacheComponents: true` and the custom `cacheLife` profiles live in `next.config.mjs` — not under `experimental`.

## 2. The SSoT is `apps/portal/lib/server-cache.ts`

Do not create a parallel helper; `pnpm agent:verify` checks these exports exist: `cacheProfiles`, `scopedTag`, `tagTenant`, `tagDepartment`, `updateTag`, `updateTags`, `updateTagInAction`, `refreshTag`, `cachedRSC`.

- `cacheProfiles` (seconds): `telemetry {10,10,60}`, `minutes {10,60,300}`, `reports {60,300,3600}`, `departments {300,3600,86400}`, `hours {60,3600,86400}`, `max {300,3600,86400}`.
- Tag builders: `scopedTag(scope, id)` → `scope:id`; `tagTenant(tenantId, resource)` → `tenant:<id>:<resource>`; `tagDepartment(slug, resource)` → `dept:<slug>:<resource>`. Build tags through these, never with inline template strings.
- `updateTag(tag)` clears Next's data cache **and** awaits `cacheInvalidateTags([tag])` for Redis L1/L2. Use it in actions so Redis does not keep serving stale rows.

## 3. Canonical mutation shape

Follow `apps/portal/app/(departments)/access-control/actions/gates.ts`: write to the DB, check for the error, then invalidate, then return.

```ts
await cacheInvalidateTags(['table:access_logs', 'table:badges', `dept:${deptId}`]);
revalidatePath('/access-control');
```

Pair both calls — tag invalidation alone leaves the route cache, `revalidatePath` alone leaves Redis. If the action ends in `redirect()`, the tag update must happen **before** it (`updateTag.md`); after a redirect there is nothing left to invalidate.

## 4. What audit:caching catches

Hard failures (exit 1): missing `cacheComponents: true`, missing `cacheLife:` profiles, missing SSoT file or any required export/profile key. Warnings that indicate real bugs: a `use cache` scope calling `cookies()`/`headers()` directly; `use cache` with no `cacheLife()`; a page reading headers/cookies without `<Suspense>`; a mutating `route.ts` (POST/PATCH/PUT/DELETE on departments/delay_entries/equipment, or any `.rpc(`) with **no** invalidation call.

`cacheLife` must be called in the caching function's own scope — abstracting it into a shared utility silently drops the profile.

Check with `node tools/audits/audit-caching.cjs`, then `pnpm agent:verify` for the full gate set.
