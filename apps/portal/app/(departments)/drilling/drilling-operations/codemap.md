# (departments)/drilling/drilling-operations/

**Kind:** page · **Files:** 4 (+1 test)

## Responsibility

React Server Component page under the (departments)/drilling/drilling-operations route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): DrillingOperationsTable.tsx
- Hooks referenced: useRouter, useCallback, useState
- Database tables touched: drill_operations, departments, machines, employees
- Exports:
  - `DrillingOperationsTable.tsx` → DrillingOperationsTable
  - `actions.ts` → upsertDrillOperationAction
  - `loading.tsx` → DrillingOperationsLoading, default
  - `page.tsx` → DrillingOperationsPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions, DrillingOperationsTable

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
