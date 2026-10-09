# (auth)/reset-password/

**Kind:** page · **Files:** 1 (+1 test)

## Responsibility

React Server Component page under the (auth)/reset-password route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): page.tsx
- Hooks referenced: useSearchParams, useEffect, useState
- Exports:
  - `page.tsx` → ResetPasswordPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
