# Next.js 16 Best Practices

Aligned with the Arch-System AGENTS.md conventions.

## App Router

- Server Components by default; interactivity in leaf `'use client'` components.
- Route through `proxy.ts` for auth/RBAC; never bypass.
- Use route groups `(auth)`, `(departments)` appropriately.

## Caching

- Use `'use cache'` only with a named `cacheLife()` profile.
- Never call `cookies()`, `headers()`, or `searchParams` inside a cache scope.
- Invalidate with `updateTagInAction` after mutations.

## Server Actions

- Authenticate -> authorize -> validate (Zod) -> rate-limit -> mutate -> invalidate -> return.
- Never call `redirect()` before cache invalidation.

## Data Fetching

- Parallelize independent queries with `Promise.all`/`Promise.allSettled`.
- Wrap shared per-request lookups in `React.cache()`.
- Stream unresolved promises into `<Suspense>` and unwrap with React 19 `use()`.

## Images

- Use `next/image` with explicit dimensions or `fill` + sized parent and descriptive `alt`.
