---
name: nextjs-comprehensive-rules
description: Comprehensive Next.js 16 standards covering App Router, RSC/client boundary, Server Actions, caching, performance, and security
paths:
  - 'apps/portal/**/*.{ts,tsx,js,jsx}'
  - 'packages/ui/src/**/*.{ts,tsx}'
  - 'libs/features/**/*.{ts,tsx}'
  - 'libs/shared/**/*.{ts,tsx}'
---

# Next.js 16 App Router Standards

1. **RSC Default**: Routes/layouts are RSC by default; push `'use client'` strictly to leaf components using hooks or browser APIs. Never declare Client Components `async`.
2. **Proxy & RBAC**: `apps/portal/proxy.ts` sets CSP + `x-nonce` and delegates to `server/proxy.ts`; layouts independently re-verify auth and department slugs (`notFound()`).
3. **7-Step Server Actions**: Authenticate → Authorize → Validate (`@repo/contract` Zod `.safeParse`) → Rate-Limit → Mutate → Dual-Tier Cache Invalidation (`updateTagInAction` before `redirect()`) → Return/Redirect.
4. **Caching & Fetching**: Require named `cacheLife()` profiles with `'use cache'`; parallelize independent reads (`Promise.all`); use `useSupabaseRealtime` for CDC and TanStack Query on client (SWR prohibited).
