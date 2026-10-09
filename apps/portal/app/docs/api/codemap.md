# docs/api/

**Kind:** page · **Files:** 2

## Responsibility

React Server Component page under the docs/api route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): page.tsx
- Exports:
  - `page.tsx` → ApiDocs, default
  - `swagger-ui-react.d.ts` → SwaggerUI, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
