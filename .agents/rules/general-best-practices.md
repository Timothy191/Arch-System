---
name: general-best-practices
description: Cross-cutting best practices for naming conventions, error handling, state management, dependency injection, and project conventions
paths:
  - 'apps/**/*'
  - 'packages/**/*'
  - 'libs/**/*'
alwaysApply: true
---

# General Best Practices

1. **Naming**: `PascalCase.tsx` components, `useXxx.ts` hooks, `kebab-case.schema.ts` schemas, `NNN_description.sql` migrations. Ban `data`/`value`/`val`/`item`/`info`/`temp`/`tmp`/`flag`/`obj`/`arr`; append units (`timeoutMs`), prefix booleans (`is`/`has`/`can`/`should`).
2. **Errors**: Extend `AppError` (`@repo/errors`), guard with `isAppError(err)` at boundaries, never swallow errors.
3. **State & DI**: RSC + TanStack Query for server state, Zustand 5 for UI state, RHF + Zod for forms, XState 5 for machines. Use factory helpers (`createServerSupabaseClient`, `getRedisClient`, `createKyselyClient`, `RateLimiter`).
4. **Imports & Budgets**: Import via canonical `@repo/*` exports (never `/src/`), keep Tailwind ≤16 utilities per `className`, and update `AGENT_TRACER.md` on package changes.
