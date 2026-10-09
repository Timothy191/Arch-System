# (auth)/

**Kind:** page · **Files:** 5 (+4 test)

## Responsibility

React Server Component page under the (auth) route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): layout.tsx, page.tsx, page.tsx
- Hooks referenced: useSearchParams, useEffect, useState, useRouter, useRef
- Exports:
  - `layout.tsx` → AuthLayout, default
  - `loading.tsx` → LoginLoading, default
  - `page.tsx` → UpdatePasswordPage, default

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
