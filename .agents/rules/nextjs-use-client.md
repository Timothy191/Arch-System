# Rule: "use client" Audit on UI Package Changes

## When This Applies

Whenever **creating or modifying** any file in `packages/ui/src/` (or any shared UI
package consumed by a Next.js App Router monorepo) that uses ANY of the following:

- `useState`, `useEffect`, `useContext`, `createContext`
- `useRef`, `useCallback`, `useMemo`, `useReducer`, `useId`
- `framer-motion` (`motion`, `AnimatePresence`)
- Any browser-only API (`window`, `document`, `navigator`, `localStorage`, etc.)

## Mandatory Actions

1. **The file MUST start with `"use client";` as the very first line** — before any imports.

2. **Before committing**, run this audit command to catch any remaining violations:
   ```bash
   find packages/ui/src -name "*.tsx" \
     | xargs grep -l "useState\|useEffect\|useRef\|useCallback\|createContext\|useContext\|framer-motion" \
     | xargs grep -L '"use client"'
   ```
   If this prints any files, add `"use client";` to each before proceeding.

3. **Never rely on the build to catch this.** Missing `"use client"` in a shared UI
   library causes a hard Turbopack/Webpack build failure in Next.js App Router:
   ```
   Error: You're importing a module that depends on `useState` into a React Server
   Component module. This API is only available in Client Components.
   ```

## Why

Next.js App Router Server Components cannot execute client-side React hooks.
When a shared package barrel (`packages/ui/src/index.ts`) re-exports both
Server-safe and Client-only components, Next.js relies on `"use client"` boundaries
at the file level to tree-shake correctly. Missing it blocks the entire build.

## Pattern

```tsx
// ✅ CORRECT — "use client" is first
"use client";

import * as React from "react";
// ...hook-using component code
```

```tsx
// ❌ WRONG — missing directive, will break Next.js App Router build
import * as React from "react";
// ...hook-using component code
```
