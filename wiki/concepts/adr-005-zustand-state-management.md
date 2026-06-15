---
title: "ADR-005: Zustand for Client State Management"
created: 2026-05-15
updated: 2026-05-15
type: decision
status: accepted
tags: [adr, state, react, decision]
sources: [wiki/comparisons/state-management.md, apps/portal/package.json]
confidence: high
---

# ADR-005: Zustand for Client State Management

## Status

**Accepted** — Implemented May 2024

## Context

We needed state management for:

- Client-side UI state (sidebar, modals, toast notifications)
- Minimal global state (most data server-rendered)
- RSC-compatible solution (no context providers)
- Small bundle footprint
- TypeScript-native API

Given Next.js 15 App Router with RSC as default, most "state" is actually server-fetched data passed via props.

## Decision

We will use **Zustand 5** for the minimal client state that exists.

### Key Architectural Choices

1. **Zustand** — ~1KB state management
2. **Minimal client state** — Only UI chrome, not application data
3. **No Redux** — Overkill for our use case
4. **No Context** — Avoids provider cascade issues

## Consequences

### Positive

- **Tiny bundle** — ~1KB vs Redux's ~11KB
- **No providers** — No React Context performance issues
- **RSC compatible** — Client components only where needed
- **TypeScript native** — No additional type packages
- **Simple API** — Hooks-based, minimal boilerplate
- **DevTools support** — Works with Redux DevTools

### Negative

- **Less ecosystem** — Fewer middleware/plugins than Redux
- **Learning curve** — Team must understand when to use client state vs server props

### Neutral

- **Persistence** — Can add persistence middleware if needed

## When to Use Zustand vs Server State

| Use Case               | Solution               | Example                           |
| ---------------------- | ---------------------- | --------------------------------- |
| UI chrome state        | Zustand                | Sidebar open/closed, active modal |
| Toast notifications    | Zustand                | Notification queue                |
| Form draft (auto-save) | Zustand                | localStorage + Zustand            |
| Application data       | Server props           | Machine list, logs, reports       |
| Real-time updates      | Supabase subscriptions | Live alerts, SCADA data           |
| User preferences       | Server + cookies       | Theme, department default         |

## Alternatives Considered

### Redux Toolkit (REJECTED)

- Excellent for complex client workflows
- Overkill for our dashboard-heavy, server-rendered app
- Larger bundle size unjustified for minimal client state
- Would consider if building offline-first features

### React Context + useReducer (REJECTED)

- Built-in but has performance issues
- Provider cascade re-renders
- No devtools integration
- More boilerplate than Zustand

### Jotai / Recoil (REJECTED)

- Good atomic state libraries
- Zustand simpler for our use case
- No compelling advantage over Zustand

### XState (REJECTED)

- Excellent for complex state machines
- Overkill for sidebar/modal state
- Would use for complex workflow UIs

## Implementation Notes

```typescript
// apps/portal/lib/stores/app-store.ts
import { create } from "zustand";

interface AppState {
  sidebarOpen: boolean;
  activeModal: string | null;
  toggleSidebar: () => void;
  openModal: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  activeModal: null,
  toggleSidebar: () =>
    set((state) => ({
      sidebarOpen: !state.sidebarOpen,
    })),
  openModal: (id) => set({ activeModal: id }),
}));
```

Usage:

```typescript
'use client'
import { useAppStore } from '~/lib/stores/app-store'

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore()
  return <button onClick={toggleSidebar}>...</button>
}
```

## Related

- [[comparisons/state-management]] — Detailed comparison
- [[portal-app-architecture]] — RSC patterns and philosophy
- [[supabase-local-dev]] — Real-time as state alternative
