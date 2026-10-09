# (departments)/access-control/visitors/

**Kind:** page · **Files:** 3

## Responsibility

React Server Component page under the (departments)/access-control/visitors route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): visitor-form.tsx
- Hooks referenced: useRef, useState, useFormStatus
- Exports:
  - `loading.tsx` → VisitorsLoading, default
  - `page.tsx` → VisitorsPage, default
  - `visitor-form.tsx` → VisitorForm

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions, visitor-form

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
