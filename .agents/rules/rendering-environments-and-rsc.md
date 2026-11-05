# Next.js Rendering Environments, Server Components & Streaming

Architectural invariants for rendering execution in Arch-System:

1. **Server Components (RSC) by Default**:
   - Default all layout and page files to Server Components.
   - Do NOT add `'use client'` unless the component requires browser event listeners, interactive DOM hooks (`useState`, `useEffect`), or client storage.
2. **Network Boundary Discipline**:
   - Place `'use client'` as low in the component hierarchy as possible (leaf components).
   - Pass Server Components as `children` or props to Client Component wrappers to preserve server rendering of descendants.
3. **Dynamic Routes with Cached Data**:
   - Leverage `React.cache()` and Next.js Cache Components (`'use cache'`) for shared queries, while letting request-specific auth checks run dynamically without duplicating work.
4. **Progressive Streaming via Suspense**:
   - Never let a slow SCADA telemetry feed or heavy reporting query block initial HTML delivery.
   - Wrap async server components in `<Suspense fallback={<Skeleton />}>` to unlock progressive HTTP streaming.
5. **Runtime Standards**:
   - Use Node.js runtime (`export const runtime = 'nodejs'`) for components and route handlers interacting with `@repo/supabase`, `@repo/redis`, or native binaries.
   - Reserve Edge runtime strictly for lightweight routing or proxy operations.
