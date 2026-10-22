# (departments)/database/

**Kind:** page · **Files:** 7 (+1 test)

## Responsibility

React Server Component page under the `(departments)/database` route.
Server Components fetch data directly via `@repo/supabase/read-replica` (no client-side fetching) and render live PostgreSQL 17 cluster metrics, RLS InitPlan status, and schema catalog telemetry.

## Design

- Client components (`"use client"`): `error.tsx`
- Database tables touched: `departments`, `employees`, `personnel`, `badges`, `machines`, `daily_logs`, `breakdowns`, `delay_entries`, `hourly_loads`, `card_print_jobs`, `access_logs`, `audit_logs`
- Exports:
  - `error.tsx` → `DatabaseError`, `default`
  - `layout.tsx` → `DatabaseLayout`, `default`
  - `loading.tsx` → `DatabaseLoading`, `default`
  - `page.tsx` → `DatabaseDashboardPage`, `default`

## Flow

Route params/segments → `connection()` dynamic opt-in → parallel `Promise.allSettled` read-replica count queries → RSC render.

## Integration

- Data layer: Supabase Postgres via `@repo/supabase/read-replica` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
