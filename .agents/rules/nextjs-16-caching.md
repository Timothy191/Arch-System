# Next.js 16 Caching & Proxy

## 1. `use cache` requires a named `cacheLife()` profile

- Source: <https://nextjs.org/docs/app/api-reference/directives/use-cache>
- Rule: Every `'use cache'` scope must call `cacheLife(profile)` with a named profile defined in `next.config.mjs`. Never cache without expiry.

## 2. No request APIs inside `'use cache'`

- Source: <https://nextjs.org/docs/app/api-reference/directives/use-cache>
- Rule: Never call `cookies()`, `headers()`, or read `searchParams` inside a `'use cache'` scope. Pass serializable params in.

## 3. `proxy.ts` is the request boundary (not middleware)

- Source: <https://nextjs.org/docs/app/api-reference/file-conventions/proxy>
- Rule: Auth, RBAC, CSP nonce live in `server/proxy.ts` invoked by `apps/portal/proxy.ts`. Do not add `middleware.ts`.

## 4. Server Actions: invalidate before redirect

- Source: <https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations>
- Rule: Call `updateTagInAction`/`revalidatePath` before `redirect()`; `redirect()` throws and skips subsequent code.

## 5. Partial Prerendering via Suspense

- Source: <https://nextjs.org/docs/app/getting-started/partial-prerendering>
- Rule: Static shell + dynamic holes wrapped in Suspense; never opt the whole route into dynamic rendering.
