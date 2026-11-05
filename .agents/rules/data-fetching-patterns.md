# Data Fetching Patterns and Best Practices

Standards and invariants for data fetching in Arch-System Next.js 16 App Router:

1. **Server Components (RSC) First**: Always fetch server-side in Server Components or Server Actions. Never leak service-role keys, raw database connections, or Redis credentials to client bundles.
2. **Colocation with Request Memoization**:
   - Fetch data directly where required rather than threading props through deep trees or parent layouts.
   - Wrap shared per-request lookups in `React.cache()` (e.g. `getDepartmentContext` in `apps/portal/lib/dept-context.ts`) so layout and leaf page share a single round-trip.
3. **No Sequential Waterfalls**:
   - Prohibit sequential `await` on independent queries (`await getA(); await getB();`).
   - Use `Promise.all` or `Promise.allSettled` for concurrent query initiation.
4. **Streaming with Suspense Boundaries**:
   - Wrap heavy components, telemetry grids, and report builders in `<Suspense fallback={<Skeleton />}>` to permit instant navigation and incremental UI streaming.
5. **Preload Pattern**:
   - For components with dynamic asynchronous dependencies, export and call eager preloaders (`void prefetchFn(id)`) before dependent execution branches.
6. **Data Tainting and RSC Boundary Defense**:
   - Maintain `experimental: { taint: true }` in Next.js config.
   - Taint sensitive credentials, auth hashes, or private employee records before returning domain objects to client-facing components.
7. **Server-Only Enforcement**:
   - Code touching database connections, cryptographic secrets, or internal RPCs must never be importable into `'use client'` contexts. Enforced by boundary audits and static policy compiler.
