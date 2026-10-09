# (departments)/[department]/reports/

**Kind:** page · **Files:** 3

## Responsibility

React Server Component page under the (departments)/[department]/reports route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): CopyReportButton.tsx
- Hooks referenced: useState
- Database tables touched: machine_operations, hourly_loads, operational_delays, excavator_dumper_assignments, dozer_rolls, daily_logs, machine_hours, fuel_logs, production_logs
- Exports:
  - `CopyReportButton.tsx` → CopyReportButton
  - `loading.tsx` → ReportsLoading, default
  - `page.tsx` → ReportsPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: CopyReportButton

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
