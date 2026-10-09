# offline/

**Kind:** page · **Files:** 2

## Responsibility

React Server Component page under the offline route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): ReloadButton.tsx
- Exports:
  - `ReloadButton.tsx` → ReloadButton, default
  - `page.tsx` → OfflinePage, metadata, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: ReloadButton

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
