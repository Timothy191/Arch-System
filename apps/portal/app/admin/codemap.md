# admin/

**Kind:** page · **Files:** 7 (+1 test)

## Responsibility

React Server Component page under the admin route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): error.tsx, page.tsx, page.tsx
- Hooks referenced: useEffect, useState
- Database tables touched: employees
- Exports:
  - `page.tsx` → WorkflowsPage, default
  - `error.tsx` → AdminError, default
  - `layout.tsx` → AdminLayout, default
  - `loading.tsx` → AdminLoading, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
