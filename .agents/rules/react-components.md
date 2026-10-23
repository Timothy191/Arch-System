---
name: react-components
description: 'React 19 component idioms (ref-as-prop, use() streaming, useActionState/useOptimistic, SSR-safe hooks), strict light mode invariant, OKLCH design tokens, and a11y standards.'
paths:
  - 'packages/ui/**/*.{ts,tsx}'
  - 'packages/theme/**/*.{ts,tsx,json,css}'
  - 'apps/portal/components/**/*.{ts,tsx}'
  - 'apps/portal/app/**/*.{ts,tsx}'
  - 'libs/features/**/ui/**/*.{ts,tsx}'
---

# React 19 & UI Component Standards

## 1. React 19 Component Idioms

- **Ref-as-Prop (Avoid `forwardRef` in New Components)**: React 19 passes `ref` as a standard prop on function components. Accept `ref?: React.Ref<HTMLElement>` directly in the component props destructuring instead of wrapping new components in `React.forwardRef`.
- **Streaming Promises with `<Suspense>` + `use(promise)`**: In Server Components, start independent queries in parallel (`Promise.allSettled` / `Promise.all`) or pass unresolved promises down to leaf components wrapped in `<Suspense fallback={...}>` and unwrap them with React 19 `use(promise)`.
- **Form & Mutation Primitives (`useActionState` / `useOptimistic`)**: Use React 19 `useActionState` and `useOptimistic` (alongside `react-hook-form` + `@hookform/resolvers/zod` where complex client validation or `arch_*_draft_*` localStorage persistence is needed) for instant, non-blocking mutation feedback.
- **SSR-Safe Client Hooks**:
  - Guard all browser-only globals (`typeof window !== 'undefined'`, `document`, `navigator`, `localStorage`) or defer access inside `useEffect`.
  - Never return `null` from a root provider (such as `ReactQueryProvider`) while waiting for client storage; render the provider immediately for SSR and attach persistence inside `useEffect`.
  - Always return cleanup functions in `useEffect` for event listeners, ResizeObservers, WebSocket/Realtime subscriptions, and timers (`clearTimeout` / `clearInterval`).

```tsx
'use client';

import { use } from 'react';

interface TelemetryButtonProps extends React.ComponentProps<'button'> {
  summaryPromise: Promise<{ activeRigs: number }>;
}

// ✅ React 19: ref is a regular prop on function components; use() unwraps streamed promises
export function TelemetryButton({ ref, summaryPromise, children, ...props }: TelemetryButtonProps) {
  const { activeRigs } = use(summaryPromise);
  return (
    <button ref={ref} type="button" {...props}>
      {children} ({activeRigs})
    </button>
  );
}
```

---

## 2. Server vs. Client Boundary Isolation

- **Server Components by Default**: Use RSC for layouts, data orchestration, and static/cached presentation. Keep `'use client';` at line 1 strictly on interactive leaf components.
- **Client Component Constraints**: Never mark a `'use client'` component `async`. Never fetch data in `useEffect` or import `swr`—use RSC, `@tanstack/react-query`, or `useSupabaseRealtime`.
- **Minimal Serialization Across RSC Boundaries**: Never pass un-serializable values (functions, class instances, symbols) or oversized raw database rows from Server to Client Components; pass only the minimal primitive props required by the leaf.
- **Pure Presentation in `@repo/ui`**: Components in `packages/ui` must never import `@repo/database` or `@repo/supabase`. Import UI primitives via granular package exports (`@repo/ui/GlassCard`, `@repo/ui/Button`), never barrel imports.

---

## 3. Design-System, Tailwind & Accessibility Rules Live Elsewhere

Light-mode-only OKLCH tokens, `GlassCard` surface variants, the `className` utility budget and Biome sort order, `next/image` sizing, and focus/ARIA requirements are owned by [`ui-taste-and-motion.md`](ui-taste-and-motion.md) and [`tailwind-utility-composition.md`](tailwind-utility-composition.md). Do not restate them here; follow those rules and verify with `pnpm audit:tokens`, `pnpm audit:tailwind` and `pnpm test:a11y`.
