# (departments)/[department]/hourly-loads/

**Kind:** page · **Files:** 5 (+2 test)

## Responsibility

React Server Component page under the (departments)/[department]/hourly-loads route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): HourlyLoadsGrid.tsx
- Hooks referenced: useSupabaseRealtime, useCallback, useEffect, useMemo, useRef, useState
- Database tables touched: machines, sites, hourly_loads, daily_logs
- Exports:
  - `actions.ts` → updateMachineSite, updateExcavatorSite, updateHourlyLoadExcavator, splitMachineHourlyLoad, saveHourlyLoad
  - `loads-utils.ts` → HOUR_PROP, loadKey, buildHourlyLoadsMap, buildHourlyLoadsGroupedMap, isHourEditable, sumHourlyTotal, HOURS_12
  - `page.tsx` → HourlyLoadsPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions, loads-utils, HourlyLoadsGrid

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
