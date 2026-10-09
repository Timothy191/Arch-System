# (departments)/[department]/shift-coverage/

**Kind:** page · **Files:** 2

## Responsibility

React Server Component page under the (departments)/[department]/shift-coverage route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): ShiftCoverageClient.tsx
- Hooks referenced: useEffect, useState
- Database tables touched: machines, machine_operations, shift_status
- Exports:
  - `ShiftCoverageClient.tsx` → ShiftCoverageClient
  - `page.tsx` → ShiftCoveragePage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: ShiftCoverageClient

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
