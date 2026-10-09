# (departments)/[department]/roll-over/

**Kind:** page · **Files:** 1

## Responsibility

React Server Component page under the (departments)/[department]/roll-over route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- (No client hooks or route methods detected — pure server/data module.)
- Database tables touched: machines, dozer_rolls
- Exports:
  - `page.tsx` → RollOverPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
