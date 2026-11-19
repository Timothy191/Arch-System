# architecture

- Run all package, git, and verification commands inside `/home/tim/Fork/Arch-System` using Node.js >=24 and `pnpm@9.15.9` exclusively, never `npm`, `yarn`, or `bun`. Confidence: 0.99
- Keep `apps/portal` as the sole Next.js 16 App Router deployable package using RSC-first pages and `proxy.ts` with per-request `x-nonce` and CSP instead of `middleware.ts`. Confidence: 0.98
- Combine `'use cache'`, `cacheLife()`, and `cacheTag()` in cached Server Components with `withCache()` Redis L1/L2 read-through, and never access `cookies()`, `headers()`, or dynamic `searchParams` inside `'use cache'`. Confidence: 0.97
- Enforce module layering boundaries: `apps/*` routes persistence through `@repo/supabase` (never `packages/database`), `packages/ui` remains strictly presentational without database or Supabase imports, `packages/theme` never imports `packages/ui`, and `tools/*` never imports runtime `@repo/supabase`. Confidence: 0.99
- Preserve Vercel (`arch-system`) as the primary host when adding Cloudflare edge augmentation (`workers/scada-monitor.js` and `AgentCoordinator` Durable Object), keeping edge SCADA telemetry strictly read-only. Confidence: 0.96

# typescript

- Enforce strict TypeScript (`strict`, `noUncheckedIndexedAccess`) with zero `any` and zero `@ts-ignore` directives across production source files. Confidence: 0.99
- Extract thresholds, timeouts, and keys to `UPPER_SNAKE_CASE` constants rather than inline magic numbers or strings (`-1`, `0`, `1` exempt). Confidence: 0.95
- Limit functions to at most two positional parameters; pass a single typed `Options` object whenever three or more inputs or any boolean flag are needed. Confidence: 0.96
- Validate edge cases with top-of-function guard clauses and early returns (max nesting depth two, no `else` after `return` or `throw`), and prefer exhaustive `Record<Key, Value>` lookup maps over `if/else if` or `switch` chains. Confidence: 0.95
- Model multi-stage state via discriminated unions on a tagged `status` field rather than parallel booleans, and default to `readonly` inputs and immutable transforms instead of mutating arguments. Confidence: 0.96
- Use semantic identifiers with units (`timeoutMs`, `maxWeightTons`) and boolean prefixes (`is`, `has`, `can`, `should`, `did`, `will`), avoiding banned names (`data`, `value`, `val`, `item`, `info`, `temp`, `tmp`, `flag`, `obj`, `arr`). Confidence: 0.95
- Never swallow errors in `catch` blocks; return a typed fallback or rethrow an `AppError` subclass from `@repo/errors` with operation context, entity IDs, and `{ cause: error }`. Confidence: 0.98

# ui

- Enforce light-mode-only styling with `#f3f4f6` (`data-theme="light"`) and semantic OKLCH CSS variables from `@repo/theme`; never use `dark:` utilities or raw hex/RGB values. Confidence: 0.99
- Build glass surfaces with `@repo/ui/GlassCard` and import UI components through canonical package subpaths (`@repo/ui/GlassCard`) rather than deep `/src/` paths. Confidence: 0.97
- Manage client server state via TanStack Query (`ReactQueryProvider`) and live updates via Supabase Realtime CDC (`useSupabaseRealtime`), never SWR or manual polling loops. Confidence: 0.98
- Keep Tailwind utility lists at or below 20 classes per element (target <= 12) and extract repeated chains of 10+ utilities into a component, CVA variant, or `cn()` constant. Confidence: 0.94

# database

- Author PostgreSQL 17 schema changes only as immutable, zero-padded `NNN_snake_case.sql` files under `packages/database/migrations/` without renaming or renumbering applied migrations. Confidence: 0.99
- Enable Row-Level Security on every `public` table, consulting `(SELECT auth.uid())` and `public.employees` for authorization checks. Confidence: 0.98
- Keep `@repo/contract` Zod 4 schemas synchronized with every database table and column (`pnpm audit:drift`) and route Redis operations through `@repo/redis` capability subpaths (`./cache`, `./session`, `./analytics`, `./search`) rather than raw Redis commands. Confidence: 0.97

# security

- Follow the canonical 8-step Server Action and Route Handler sequence: Authenticate (`getAuthenticatedEmployee`), Authorize, Validate (`@repo/contract`), Rate-limit (`RateLimiter` / `withRateLimit`), Execute, Audit log, Invalidate caches (`updateTag` before any `redirect()`), and Return typed result. Confidence: 0.99
- Always import server Supabase clients directly from `@repo/supabase/server` or `@repo/supabase/service-role` so `next/headers` never leaks into client bundles, and never return raw database errors or service-role credentials to clients. Confidence: 0.99
- Never commit or embed API tokens, bearer credentials, or inline authorization headers inside local Command Code settings or repository config files. Confidence: 0.99

# testing

- Keep unit tests deterministic and isolated at network boundaries, and run targeted package checks (`pnpm --filter portal test`, `pnpm --filter portal type-check`) before full monorepo suites. Confidence: 0.94

# tooling

- Verify every change before completion using `pnpm agent:verify`, Command Code taste validation, and `pnpm biome check` (`pnpm lint`), and record workspace changes only in root `AGENT_TRACER.md`. Confidence: 0.98
