# (departments)/[department]/excavator-activity/

**Kind:** page · **Files:** 5

## Responsibility

React Server Component page under the (departments)/[department]/excavator-activity route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): ExcavatorActivityForm.tsx, ExcavatorActivityList.tsx, ExcavatorDumperTable.tsx
- Hooks referenced: useRouter, useEffect, useState
- Database tables touched: excavator_activity, excavator_dumper_assignments, machines, operators, sites, mine_blocks, hourly_loads
- Exports:
  - `ExcavatorActivityForm.tsx` → ExcavatorActivityForm
  - `ExcavatorActivityList.tsx` → ExcavatorActivityList
  - `ExcavatorDumperTable.tsx` → ExcavatorDumperTable
  - `loading.tsx` → ExcavatorActivityLoading, default
  - `page.tsx` → ExcavatorActivityPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: ExcavatorDumperTable, ExcavatorActivityForm, ExcavatorActivityList

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
