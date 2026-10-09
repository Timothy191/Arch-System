# (departments)/access-control/access-logs/

**Kind:** page · **Files:** 1

## Responsibility

React Server Component page under the (departments)/access-control/access-logs route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- (No client hooks or route methods detected — pure server/data module.)
- Exports:
  - `page.tsx` → AccessLogsPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
