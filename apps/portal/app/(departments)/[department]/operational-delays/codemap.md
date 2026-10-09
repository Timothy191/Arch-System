# (departments)/[department]/operational-delays/

**Kind:** page · **Files:** 2

## Responsibility

React Server Component page under the (departments)/[department]/operational-delays route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- (No client hooks or route methods detected — pure server/data module.)
- Exports:
  - `loading.tsx` → OperationalDelaysLoading, default
  - `page.tsx` → OperationalDelaysPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
