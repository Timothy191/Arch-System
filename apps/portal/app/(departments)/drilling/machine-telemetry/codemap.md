# (departments)/drilling/machine-telemetry/

**Kind:** page · **Files:** 3

## Responsibility

React Server Component page under the (departments)/drilling/machine-telemetry route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): RealtimeDrillTelemetryStream.tsx
- Hooks referenced: useEffect, useState
- Database tables touched: departments, machines, machine_telemetry_archive
- Exports:
  - `RealtimeDrillTelemetryStream.tsx` → RealtimeDrillTelemetryStream
  - `loading.tsx` → MachineTelemetryLoading, default
  - `page.tsx` → MachineTelemetryPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: RealtimeDrillTelemetryStream

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
