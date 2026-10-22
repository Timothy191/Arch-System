# (departments)/engineering/

**Kind:** page · **Files:** 5 (+1 test)

## Responsibility

React Server Component page under the (departments)/engineering route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): error.tsx
- Database tables touched: breakdowns, tire_inspections, tires, machines
- Exports:
  - `error.tsx` → EngineeringError, default
  - `layout.tsx` → EngineeringLayout, default
  - `loading.tsx` → EngineeringLoading, default
  - `page.tsx` → EngineeringDashboardPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
