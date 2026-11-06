---
name: api-guidelines
description: Architecture, Zod contract validation, RLS & service-role authorization, Kysely/RPC query composition, and N+1 prevention for Next.js App Router API routes and Server Actions.
paths:
  - 'apps/portal/app/api/**/*.{ts,js}'
  - 'apps/portal/**/actions*.{ts,js}'
  - 'apps/portal/lib/**/*.{ts,js}'
  - 'packages/contract/src/**/*.{ts,js}'
  - 'packages/supabase/src/**/*.{ts,js}'
---

# API, Server Action & Data-Fetching Guidelines

## 1. Zod Contract SSoT (`@repo/contract`)

- Validate all API payloads, query params, and Server Action inputs with `schema.safeParse(rawInput)` against `packages/contract/src/schemas/*.schema.ts`.
- Never trust unvalidated bodies, `FormData`, headers, or route params; throw/return `ValidationError` (HTTP 400, `@repo/errors`).
- Every table/column and API payload keeps 1:1 parity in `@repo/contract`, verified by `pnpm audit:drift` (`tools/audits/audit-contract-drift.cjs`).

## 2. Authorization, RLS & Service-Role

- **Canonical 8-Step Sequence**: 1. Authenticate → 2. Authorize → 3. Validate (Zod) → 4. Rate-limit (`@repo/rate-limiter`) → 5. Execute → 6. Audit (`@repo/logger`) → 7. Invalidate (`updateTagInAction`/`updateTag`) → 8. Return typed result. Never `redirect()` before invalidation (it throws a control-flow exception).
- **Identity**: authenticate first with `createServerSupabaseClient()` (`@repo/supabase/server`) + `getUserSafely(supabase)` (JWT verified via `auth.getClaims()`). **Never** use `supabase.auth.getSession()` server-side for authorization.
- **Gating**: authorize against `public.employees` (`role`, `department_id`, `accessible_departments`) in addition to RLS.
- **Service role**: `createServiceRoleClient()` (`@repo/supabase/service-role`) bypasses RLS — only for trusted server-only jobs, webhooks, admin/transactional flows after explicit caller RBAC. Never import `@repo/supabase/service-role`, `/server`, `/kysely`, `/read-replica`, or `@repo/database` in `'use client'` modules (`audit:data-fetching`, `audit:hooks`).

## 3. Data-Fetching & N+1 Prevention

- **Parallelize** independent reads (`Promise.all`/`Promise.allSettled`); no sequential `await supabase...` waterfalls or queries in loops (`audit:data-fetching`). Dedupe per-request lookups with `React.cache()`.
- **Joins/aggregations**: Kysely (`createKyselyClient()`, `@repo/supabase/kysely`) or typed RPCs (`supabase.rpc(...)`) instead of N+1 round-trips. Read-only dashboards/reporting: `createReadReplicaClient()` (`@repo/supabase/read-replica`).
- **Live updates**: `useSupabaseRealtime` (`@repo/shared/hooks`) instead of `setInterval` + `fetch` polling. `swr` is prohibited (`audit:hooks`).

## 4. Response & `AppError` Envelopes

Handle errors via `isAppError(err)`; never leak raw Postgres errors or stack traces.

```typescript
return NextResponse.json({ success: true, data: result, timestamp: Date.now() });
return NextResponse.json(
  {
    success: false,
    error: appError.message,
    code: appError.code,
    details: appError.details ?? null,
  },
  { status: appError.statusCode || 500 }
);
```
