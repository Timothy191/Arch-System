# (departments)/[department]/engineering-notes/

**Kind:** page · **Files:** 6

## Responsibility

React Server Component page under the (departments)/[department]/engineering-notes route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): EngineeringNotesForm.tsx, EngineeringNotesList.tsx, PredictiveAlertsWidget.tsx
- Hooks referenced: useOfflineQueue, useAutoSave, useRouter, useState, useEffect
- Database tables touched: engineering_notes, machines, breakdowns_control_room_view
- Exports:
  - `EngineeringNotesForm.tsx` → EngineeringNotesForm
  - `PredictiveAlertsWidget.tsx` → PredictiveAlertsWidget
  - `actions.ts` → createEngineeringNote
  - `loading.tsx` → EngineeringNotesLoading, default
  - `page.tsx` → EngineeringNotesPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions, EngineeringNotesForm, EngineeringNotesList, PredictiveAlertsWidget

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
