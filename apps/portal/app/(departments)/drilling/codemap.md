# (departments)/drilling/

**Kind:** page · **Files:** 12 (+1 test)

## Responsibility

React Server Component page under the (departments)/drilling route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): DrillingOperationsTable.tsx, error.tsx, RealtimeDrillTelemetryStream.tsx
- Hooks referenced: useRouter, useCallback, useState, useEffect
- Database tables touched: drill_operations, departments, machines, employees, machine_telemetry_archive, daily_logs, operational_delays
- Exports:
  - `DrillingOperationsTable.tsx` → DrillingOperationsTable
  - `actions.ts` → upsertDrillOperationAction
  - `loading.tsx` → MachineTelemetryLoading, default
  - `page.tsx` → DrillingReportsPage, default
  - `error.tsx` → DrillingError, default
  - `layout.tsx` → DrillingLayout, default
  - `RealtimeDrillTelemetryStream.tsx` → RealtimeDrillTelemetryStream

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions, DrillingOperationsTable, RealtimeDrillTelemetryStream

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
