---
name: react-industrial-hooks
description: Standardized industrial React 19 hook development, SSR hydration guards, and single-source client cache invariants (TanStack Query vs SWR).
---

# React Industrial Hooks & Single-Source Cache Runbook

This skill governs the authoring, maintenance, and auditing of client-side React 19 hooks and data synchronizers in Arch-System.

## Architectural Mandates & Invariants

### 1. Single-Source Client Query Invariant (Anti-SWR Duplication Rule)

- **Mandate**: `@tanstack/react-query` is the sole authorized client-side query cache library in Arch-System (`apps/portal/package.json`).
- **Hard Negative**: NEVER import `swr`, `swr/mutation`, or `swr/infinite`. Introducing secondary client query caches causes cache desynchronization, duplicate background polling on field cellular networks, and bundle bloat.
- **Server-First Hierarchy**:
  1. Primary reads execute in React Server Components (RSC) wrapped in `<Suspense>`.
  2. Next.js 16 Cache Components handle shared data caching with `'use cache'` and `cacheLife()`.
  3. TanStack Query handles complex interactive client mutations and optimistic UI states.
  4. Supabase Realtime CDC (`useSupabaseRealtime`) streams live database updates.

### 2. SSR Hydration Safety & Browser Global Guards

- **Mandate**: Custom hooks accessing browser globals (`window`, `document`, `navigator`, `localStorage`, `sessionStorage`) must strictly guard against `undefined` during Server-Side Rendering (SSR).
- **Patterns**:
  - Prefer `useSyncExternalStore` with explicit `getServerSnapshot` for browser state.
  - Wrap DOM event listeners and browser APIs inside `useEffect` or check `typeof window !== 'undefined'`.
  - Mark hook files with `'use client'` at line 1.

### 3. Industrial Field Terminal Resilience

- Mining pit terminals encounter high vibration, dust, and intermittent satellite ("lie-fi") connectivity.
- Use `usePitConnectivity` to sense network quality and degrade gracefully.
- Use `useDebounce` or `useThrottle` to protect against double-clicks or noisy touchscreen sensor bounces.
- Use `useLocalStorage` with schema validation to buffer unsubmitted shift closeout drafts.

## Audit Command

```bash
pnpm audit:hooks
```

Runs `tools/audits/audit-hooks-and-clients.cjs` to enforce zero SWR imports and SSR hydration safety across `libs/shared/hooks`.
