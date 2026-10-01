---
name: next-ssr-hydration
description: Rules for preventing SSR Hydration Blocks in Next.js Providers
---

# Next.js 16 SSR Hydration Constraints

NEVER return `null` inside a root layout Provider (like `ReactQueryProvider`) while waiting for client-side APIs (`localStorage`, `window`). Returning null at the root level completely breaks Server-Side Rendering (SSR) for the entire application tree.

Instead of conditionally rendering the provider, render the standard provider (`QueryClientProvider`) immediately for SSR, and initialize client-side persistence plugins (like `persistQueryClient`) lazily inside a `useEffect` hook without blocking the React tree.
