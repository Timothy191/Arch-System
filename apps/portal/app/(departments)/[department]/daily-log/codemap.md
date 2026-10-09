# (departments)/[department]/daily-log/

**Kind:** page · **Files:** 4 (+1 test)

## Responsibility

React Server Component page under the (departments)/[department]/daily-log route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): DailyLogForm.tsx
- Hooks referenced: useOfflineQueue, useRouter, useEffect, useMemo, useState, useForm, useUnsavedChangesWarning
- Database tables touched: daily_logs, production_logs, machines
- Exports:
  - `DailyLogForm.tsx` → DailyLogForm
  - `actions.ts` → createDailyLog
  - `loading.tsx` → DailyLogLoading, default
  - `page.tsx` → DailyLogPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions, DailyLogForm

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
