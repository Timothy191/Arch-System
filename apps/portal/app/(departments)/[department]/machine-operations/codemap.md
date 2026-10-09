# (departments)/[department]/machine-operations/

**Kind:** page · **Files:** 7

## Responsibility

React Server Component page under the (departments)/[department]/machine-operations route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): DelayEntriesForm.tsx, MachineOperationsComplianceWidget.tsx, MachineOperationsForm.tsx, MachineOperationsList.tsx
- Hooks referenced: useOfflineQueue, useCallback, useEffect, useState, useUnsavedChangesWarning, useRouter
- Database tables touched: delay_categories, delay_entries, employees, machine_operations, machines, operators, sites, hourly_loads, breakdowns
- Exports:
  - `DelayEntriesForm.tsx` → DelayEntriesForm
  - `MachineOperationsComplianceWidget.tsx` → MachineOperationsComplianceWidget
  - `MachineOperationsForm.tsx` → MachineOperationsForm
  - `actions.ts` → saveDelayEntriesBatch
  - `loading.tsx` → MachineOperationsLoading, default
  - `page.tsx` → MachineOperationsPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions, DelayEntriesForm

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
