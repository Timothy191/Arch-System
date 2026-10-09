# hub/

**Kind:** page · **Files:** 5 (+1 test)

## Responsibility

React Server Component page under the hub route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): error.tsx
- Hooks referenced: useEffect
- Database tables touched: machines, employees, breakdowns
- Exports:
  - `error.tsx` → HubError, default
  - `page.tsx` → HubPage, metadata, default
  - `layout.tsx` → HubLayout, default
  - `loading.tsx` → HubLoading, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
