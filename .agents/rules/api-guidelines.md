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

## 1. Canonical Zod Contract SSoT (`@repo/contract`)

- Validate all incoming API payloads, query parameters, and Server Action inputs against canonical Zod schemas in `packages/contract/src/schemas/*.schema.ts` using `schema.safeParse(rawInput)`.
- Never trust unvalidated client bodies, `FormData`, headers, or route params; throw or return `ValidationError` (HTTP 400) from `@repo/errors` on failure.
- Every database table/column and API payload must maintain 1:1 schema parity in `@repo/contract`, verified by `pnpm audit:drift` (`tools/audits/audit-contract-drift.cjs`).

## 2. Authorization, Tenant RLS & Service-Role Restrictions

- **Server Action / Route Handler execution order**: **authenticate → authorize → validate (`@repo/contract` Zod) → rate-limit (`@repo/rate-limiter`) → mutate → invalidate cache (`updateTagInAction` / `updateTag`) → `redirect()`**. Never call `redirect()` before cache invalidation (`redirect()` throws a control-flow exception).
- **Verified identity**: Authenticate on line 1 using `createServerSupabaseClient()` (`@repo/supabase/server`) and `getUserSafely(supabase)` (verifies JWT signature via `auth.getClaims()`). **Never** call `supabase.auth.getSession()` on the server for authorization decisions.
- **Department & role gating**: Authorize against `public.employees` (`role`, `department_id`, `accessible_departments`) in addition to PostgreSQL RLS.
- **Service-role isolation**: `@repo/supabase/service-role` (`createServiceRoleClient()`) bypasses all RLS and is strictly restricted to trusted server-only background jobs, webhooks, or admin/transactional workflows after explicit caller RBAC verification. Never import `@repo/supabase/service-role`, `@repo/supabase/server`, `@repo/supabase/kysely`, `@repo/supabase/read-replica`, or `@repo/database` in `'use client'` modules (`audit:data-fetching`, `audit:hooks`).

## 3. Data-Fetching, Kysely / RPCs & N+1 Prevention

- **Parallelize independent queries**: Combine independent reads with `Promise.all` or `Promise.allSettled`; never chain sequential `await supabase...` waterfalls or run queries inside `for`/`while` loops (`audit:data-fetching`). Deduplicate shared per-request lookups with `React.cache()`.
- **Complex joins & aggregations**: Use Kysely (`createKyselyClient()` from `@repo/supabase/kysely`) or typed PostgreSQL RPCs (`supabase.rpc(...)`) for multi-table joins, CTEs, and aggregations instead of N+1 client/server round-trips. Use `createReadReplicaClient()` (`@repo/supabase/read-replica`) for read-only dashboard/reporting queries.
- **Live updates via Realtime CDC**: Use `useSupabaseRealtime` (`@repo/shared/hooks`) for live Postgres CDC streaming instead of manual polling loops (`setInterval` + `fetch`). Client-side `swr` is strictly prohibited (`audit:hooks`).

## 4. Standardized Response & `AppError` Envelopes

- Handle all errors via `isAppError(err)` (`@repo/errors`) and never leak raw Postgres errors or stack traces:
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
