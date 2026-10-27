# Cookbook: Deliver a Portal Feature

## Use when

Adding or changing a user-facing workflow under `apps/portal` or `libs/features/*`.

## Steps

1. **Locate the owning slice**
   - Department UI: `libs/features/departments/ui` or the relevant department route.
   - Reads/writes: the matching `data-access` package.
   - Shared behavior: `libs/shared/*` only when it is genuinely cross-domain.
2. Read the nearest `AGENTS.md`, then trace the route, server action/handler, query, schema, and existing test.
3. Keep Server Components by default. Put `'use client'` only at interactive leaves.
4. Validate all mutation inputs with a schema from `@repo/contract`.
5. Route persistence through `@repo/supabase`; never import `packages/database` from `apps/*`.
6. Use the canonical error hierarchy from `@repo/errors`, structured logging from `@repo/logger`, and named Redis capabilities from `@repo/redis`.
7. Invalidate cache tags and paths together for mutations. Follow `apps/portal/lib/server-cache.ts`.
8. Add co-located Jest coverage for behavior and failure paths. Keep portal thresholds in mind.

## Checks

```bash
pnpm --filter portal type-check
pnpm --filter portal test -- <changed-test-path> --runInBand
pnpm lint
pnpm audit:drift
pnpm policy:check
pnpm agent:verify
```

## Done when

The feature has a typed contract, scoped authorization, tested success and failure behavior, correct cache invalidation, and no boundary or token violations.
