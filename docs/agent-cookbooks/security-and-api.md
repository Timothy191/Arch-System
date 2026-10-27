# Cookbook: Auth, Proxy, and API Security

## Use when

Changing `apps/portal/proxy.ts`, `server/proxy.ts`, route handlers, server actions, roles, permissions, cookies, or security headers.

## Steps

1. Read the relevant Next.js 16 guide in `node_modules/next/dist/docs/` before changing proxy, route, caching, or request APIs.
2. Trace the route through `apps/portal/proxy.ts` and `server/proxy.ts`; preserve `DEPARTMENT_ROUTES`, `RESTRICTED_ROUTES`, Supabase SSR refresh, RBAC lookup, CSP nonce, and security headers.
3. Enforce authorization server-side. UI visibility is not authorization.
4. Parse body, query, path, and headers with canonical Zod schemas before use.
5. Use typed `AppError` responses; do not leak stack traces, tokens, SQL, or provider secrets.
6. Add rate limiting and idempotency for public, expensive, or repeatable mutations using the named package capabilities.
7. Keep secrets server-only. Never expose service keys, Redis credentials, cron secrets, or scanner keys to client bundles.
8. Test unauthenticated, unauthorized, valid, malformed, replayed, and cross-tenant requests.

## Checks

```bash
pnpm --filter portal type-check
pnpm --filter portal test -- <changed-test-path> --runInBand
pnpm policy:check
pnpm audit:hooks
pnpm lint:migrations
pnpm agent:verify
```

## Done when

Access is denied by default, tenant scope is explicit, sensitive responses are safe, replay and abuse controls exist where needed, and tests cover the security boundary.
