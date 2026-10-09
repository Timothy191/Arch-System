# docs/

**Kind:** page · **Files:** 4

## Responsibility

React Server Component page under the docs route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): page.tsx
- Database tables touched: employees
- Exports:
  - `page.tsx` → DocsLandingPage, metadata, default
  - `swagger-ui-react.d.ts` → SwaggerUI, default
  - `layout.tsx` → DocsLayout, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
