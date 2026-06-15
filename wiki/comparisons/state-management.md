---
title: State Management Comparison
created: 2026-05-15
updated: 2026-05-15
type: comparison
tags: [state, react, architecture, decision]
sources: [apps/portal/package.json, wiki/concepts/portal-app-architecture.md]
confidence: high
---

# State Management Comparison: Zustand vs Redux Toolkit vs React Context

## What is Being Compared

Selection of state management approach for a Next.js 15 App Router application with React Server Components (RSC) as the default pattern.

## Dimensions of Comparison

| Dimension             | Zustand 5                    | Redux Toolkit           | React Context + useReducer       |
| --------------------- | ---------------------------- | ----------------------- | -------------------------------- |
| **Bundle Size**       | ~1KB                         | ~11KB                   | 0KB (built-in)                   |
| **Boilerplate**       | Minimal                      | Moderate                | Minimal to moderate              |
| **DevTools**          | Basic Redux DevTools support | Excellent DevTools      | Browser React DevTools           |
| **RSC Compatibility** | Client components only       | Client components only  | Can work in RSC (pass via props) |
| **SSR/Next.js**       | Requires `'use client'`      | Requires `'use client'` | Works in both                    |
| **Persistence**       | Middleware available         | Redux Persist           | Manual implementation            |
| **Selectors**         | Manual or computed           | Reselect integration    | Manual                           |
| **Async Logic**       | In actions or thunks         | RTK Query / thunks      | useEffect + dispatch             |
| **TypeScript**        | Excellent                    | Excellent               | Good                             |

## Project Implementation

The portal uses **Zustand 5** selectively:

```typescript
// Client components with complex state
"use client";
import { create } from "zustand";

interface AppState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

## Why Zustand Was Chosen

1. **RSC-first architecture** — Most state lives in Server Components (props) or URL params
2. **Minimal client state needs** — Only UI chrome state (sidebar, modals, toasts)
3. **Bundle efficiency** — 1KB vs 11KB for Redux
4. **No context provider cascade** — Avoids React Context performance issues
5. **TypeScript-native** — No additional type packages needed

## Why Not Redux Toolkit

Redux Toolkit is excellent for complex client-side state, but the portal's architecture:

- Uses Server Components for data fetching (no client state needed)
- Defers to Supabase real-time subscriptions for live data
- Has minimal shared client state (mostly UI chrome)

## Why Not React Context

Context is used sparingly for:

- Theme injection (but `@repo/theme` handles most)
- Supabase client context (but `@repo/supabase` abstracts this)

Zustand's hook-based API is cleaner for cross-component UI state than Context's provider pattern.

## Verdict

**Zustand 5 is optimal** for this RSC-heavy architecture where client state is minimal. Redux Toolkit would be considered if the application grew complex client-side workflows (offline support, optimistic updates).

## Related

- [[portal-app-architecture]] — RSC patterns and state philosophy
- [[supabase-local-dev]] — Real-time subscriptions as state alternative
