# (departments)/[department]/shift-compilation/

**Kind:** page · **Files:** 5

## Responsibility

React Server Component page under the (departments)/[department]/shift-compilation route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): ShiftCompilationClient.tsx
- Hooks referenced: useRouter, useState
- Database tables touched: employees, shift_status
- Exports:
  - `ShiftCompilationClient.tsx` → ShiftCompilationClient
  - `actions.ts` → getUnifiedShiftReport, getMultiSiteShiftReport, lockAndSignUnifiedShift
  - `loading.tsx` → ShiftCompilationLoading, default
  - `page.tsx` → ShiftCompilationPage, default
  - `pdf-actions.ts` → exportSignedShiftReportPdf

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions, pdf-actions, ShiftCompilationClient

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
