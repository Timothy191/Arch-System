# Arch-System — Testing & QA

> Test frameworks, the Jest 30 single-source-of-truth invariant, test execution
> commands, mocking strategies, the Jest diagnostic command guard, and coverage
> thresholds. Extracted from the former monolithic `AGENTS.md`.

## Test Frameworks & Test Types

- **Unit & Integration**: **Jest 29/30** with `@swc/jest` (`apps/portal`, `packages/*`, `libs/*`).
  - `jsdom`: For React 19 UI components and hooks (`apps/portal/setupTests.ts` injects web API polyfills).
  - `node`: For backend packages (`@repo/contract`, `@repo/errors`, `@repo/rate-limiter`, `@repo/redis`). Server actions and API routes in `apps/portal` declare `/** @jest-environment node */` at the file top.
- **End-to-End (E2E) & Visual**: **Playwright Test** (`e2e/`) running against Chromium viewports with auth session caching.
- **Component Accessibility**: **Storybook Test Runner** + `axe-playwright` (`packages/ui`) automating WCAG compliance checks.
- **AI Evaluation**: **Pytest** + **DeepEval** (`packages/eval`) testing LLM outputs, factual consistency, and hallucination bounds.
- **Database Migrations**: Node.js test runner verifying rollback safety (`packages/database/tests/migration-rollback-safety.mjs`) and PostgreSQL psql scripts asserting RLS security policies.
- **Load & Performance**: **k6** (`k6/stress-test.js`) enforcing latency thresholds (`p(99) < 1500ms`, `rate < 0.01`).
- **Dynamic Security**: **OWASP ZAP** (`scripts/pentest.sh`) running containerized baseline penetration scans.

### Single-Source Unit Test Runner Invariant (Anti-Runner Fragmentation / Jest 30 SSoT)

- **Mandate**: All unit and integration testing across TypeScript packages (`apps/portal`, `packages/*`, `libs/*`) is strictly standardized on **Jest 30** with `@swc/jest`. Introducing fragmented secondary test runners (such as `ava`, `mocha`, or `tape`) is prohibited.
- **Hard Negatives**:
  - NEVER introduce `ava`, `mocha`, or alternative runner packages into `package.json` dependencies.
  - NEVER author test files with conflicting assertion syntax (e.g. AVA's `t.is`, `t.deepEqual`) outside standard Jest `expect()` and Playwright `expect()`.
  - NEVER fragment Turborepo test execution across incompatible CLI test runners.
- **Quality Gate**: Verified automatically via `pnpm audit:hooks` (part of `pnpm audit:compliance`).

### Test Execution Commands

```bash
# Run all unit/integration tests across all packages via Turborepo
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage collection
pnpm test:coverage

# Run tests in apps/portal only
pnpm --filter portal test

# Run a single isolated Jest test file in apps/portal
pnpm --filter portal test -- apps/portal/app/api/health/route.test.ts

# Run tests matching a specific name pattern
pnpm --filter portal test -- -t "submitShiftCloseout"

# Run tests for specific packages or libs
pnpm --filter @repo/errors test
pnpm --filter @repo/redis test
pnpm --filter @repo/contract test
pnpm --filter @repo/rate-limiter test
pnpm --filter @repo/database test

# Run Playwright E2E tests (requires server on :3000)
pnpm test:e2e

# Run Playwright visual regression smoke tests
pnpm test:e2e:visual

# Run Playwright in interactive UI mode
pnpm exec playwright test --ui --config=e2e/playwright.config.ts

# Update golden visual comparison snapshots
pnpm exec playwright test --config=e2e/playwright.config.ts --update-snapshots

# Run Storybook accessibility checks (axe-playwright)
pnpm test:a11y

# Run AI evaluation suite (DeepEval)
cd packages/eval && poetry run pytest tests/ -v
```

### Mocking Strategies & Invariants

- **Mock at Network Boundaries**: Mock external services at network client boundaries (`@repo/supabase/server`, `@repo/redis`, `fetch`). NEVER mock internal business logic or pure calculation functions.
- **Redis Mock**: Unit tests in `setupTests.ts` use an in-memory `Map` simulating Redis commands (`get`, `set`, `del`, `incr`, `expire`) to prevent socket timeouts.
- **Supabase Query Spies**: Mock Supabase using chained query builder spies (`.from().select().eq().single()`).
- **Next.js Cache Mocks**: In tests, `unstable_cache` passes through to the underlying callback `(cb) => cb`; `revalidatePath` and `revalidateTag` are mocked via `jest.fn()`.
- **E2E Auth Caching**: `e2e/global.setup.ts` completes a one-time login before test workers run and saves session credentials to `e2e/.auth/user.json`. Playwright browser contexts consume `storageState: 'e2e/.auth/user.json'`.
- **Database Safety Invariants**:
  - Migrations must strictly match `packages/database/migrations/NNN_description.sql` (3-digit zero-padded prefix).
  - Every new table must enable RLS on line 1 immediately following creation (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
  - Rollback safety verified by `packages/database/tests/migration-rollback-safety.mjs`.

### Coverage & Quality Gate Thresholds

Configured in `apps/portal/jest.config.cjs`:

- **Statements**: 40%
- **Branches**: 30%
- **Functions**: 30%
- **Lines**: 40%
- **Strategic Target**: Long-term strategy mandates critical mutations (Server Actions, RLS helper policies, Auth, AI provider failovers) reach 90%+ unit coverage.
- **Output Directory**: `apps/portal/coverage/` (HTML, LCOV, text summary).

---

## Full Text: Code Conventions, Errors & Patterns

> The remainder of the former monolithic `AGENTS.md`: formatting, naming, the canonical
> `AppError` hierarchy, a complete Server Action template, DI service factories, state
> management strategy, file-length limits, and the key-files table.

### Formatting & Code Style

- **Formatter & Primary Linter**: **Biome** (`biome.json`).
  - Indentation: 2 spaces.
  - Line width: 100 columns.
  - Quotes: Single quotes for TypeScript/JavaScript; double quotes for JSX.
  - Semicolons: Always required.
  - Trailing commas: ES5 standard.

### Naming Conventions

- **React Components**: PascalCase (`GlassCard.tsx`, `ShiftCloseoutModal.tsx`).
- **Hooks**: camelCase prefixed with `use` (`usePitConnectivity.ts`, `useSupabaseRealtime.ts`).
- **Schemas**: kebab-case with `.schema.ts` suffix (`shift-closeout.schema.ts`).
- **Types**: kebab-case with `.types.ts` suffix (`shift-closeout.types.ts`).
- **Utilities**: kebab-case (`cache-utils.ts`, `crypto.ts`).
- **Database Migrations**: Zero-padded 3-digit prefix + snake_case (`NNN_description.sql`, e.g., `163_shift_closeout_rpc.sql`).
- **Tests**: Co-located `<target>.test.ts(x)` for Jest; `<name>.spec.ts` for Playwright E2E.

### Canonical Error Handling (`packages/errors/src/index.ts`)

All domain and runtime errors MUST extend `AppError`:

- Base: `AppError` (`message`, `code`, `statusCode`, `context`, `cause`).
- Subclasses:
  - 400 Bad Request: `ValidationError` (includes `field` and invalid `value`).
  - 401 Unauthorized: `AuthError`.
  - 403 Forbidden: `ForbiddenError`.
  - 404 Not Found: `NotFoundError`.
  - 409 Conflict: `ConflictError`.
  - 429 Rate Limited: `RateLimitError`.
  - 500 Database: `DatabaseError`.
  - 502/504 Network/Timeout: `NetworkError`, `FetchTimeoutError`.
- Type Guard: Use `isAppError(error)` to extract status codes safely across server and client boundaries.

### Async Patterns & Server Actions

- Server Actions MUST declare `'use server';` on line 1, authenticate via session, check permissions against `employees`, validate inputs with `@repo/contract`, enforce rate limits, and return typed results.

```typescript
'use server';

import { createServerSupabaseClient } from '@repo/supabase/server';
import { shiftCloseoutSchema, type ShiftCloseoutInput } from '@repo/contract';
import { checkRateLimit } from '@repo/rate-limiter';
import { cacheInvalidateTags } from '@repo/redis';
import {
  isAppError,
  ValidationError,
  RateLimitError,
  DatabaseError,
  AuthError,
} from '@repo/errors';

export async function submitShiftCloseout(rawInput: ShiftCloseoutInput) {
  try {
    // 1. Validate payload against canonical Zod contract schema
    const parseResult = shiftCloseoutSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.issues[0]?.message);
    }

    // 2. Check rate limit
    const allowed = await checkRateLimit(parseResult.data.supervisorId);
    if (!allowed) throw new RateLimitError('Rate limit exceeded');

    // 3. Obtain authenticated Supabase server client
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AuthError('Unauthorized');

    // 4. Execute atomic RPC or query
    const { data, error } = await supabase.rpc('atomic_shift_closeout', {
      p_shift_id: parseResult.data.shiftId,
      p_payload: parseResult.data,
    });
    if (error) throw new DatabaseError(error.message);

    // 5. Invalidate caches across instances
    await cacheInvalidateTags(['shift_closeout', `dept_${parseResult.data.deptId}`]);

    return { success: true, data };
  } catch (err: unknown) {
    if (isAppError(err)) return { success: false, error: err.message, code: err.code };
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}
```

### Dependency Injection & Service Factories

Runtime clients are decoupled behind factory helpers to prevent environment leaks and enable testing:

- **Server Supabase**: `createServerSupabaseClient()` from `@repo/supabase/server` (uses Next.js cookie store + query telemetry).
- **Browser Supabase**: `createBrowserSupabaseClient()` from `@repo/supabase/client`.
- **Kysely Query Builder**: `createKyselyClient()` from `@repo/supabase/kysely`.
- **Redis Client & Cache**: `getRedisClient()` and `cacheGetOrSet()` from `@repo/redis`.
- **Rate Limiter**: `RateLimiter` class accepting modular `IStore` (`RedisStore` / `MemoryStore`) and `IStrategy` (`FixedWindowStrategy`, `SlidingWindowStrategy`, `TokenBucketStrategy`).

### State Management Strategy

1. **Server State**: React Server Components (RSC) by default, combined with TanStack React Query (`@tanstack/react-query`) for polling, client refetches, and cache synchronization.
2. **Ephemeral / Client State**: Lightweight Zustand 5 stores (`useDockPreferences.ts`, `useNavigationState.ts`, `useOfflineQueue.ts`).
3. **Form State**: React Hook Form with Zod resolvers (`@hookform/resolvers/zod`) paired with local storage draft persistence (`arch_*_draft_*`).
4. **Complex State Machines**: XState 5 actors (`orchestrator.machine.ts`) for multi-step hardware and shift closeout lifecycles.

### File Length Limits & Modularity

- Target: 400–450 lines per file.
- Hard ceiling: 500 lines. Proactively decompose bloated files into subcomponents, domain hooks, or utility files.

---

## Important Files

| Category                   | File Path                                                 | Description                                                                       |
| :------------------------- | :-------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **Edge Interceptor**       | `apps/portal/proxy.ts`                                    | Next.js 16 Edge proxy validating sessions, employee roles, and security headers.  |
| **App Layout**             | `apps/portal/app/layout.tsx`                              | Root portal layout mounting themes, providers, and global UI layers.              |
| **App Next Config**        | `apps/portal/next.config.mjs`                             | Standalone output, Turbopack root, transpilePackages, and CSS inlining.           |
| **Contract SSoT**          | `packages/contract/src/index.ts`                          | Central export of all Zod validation schemas and contract types.                  |
| **Database Migrations**    | `packages/database/migrations/`                           | 164+ sequential PostgreSQL migrations defining schemas and RLS policies.          |
| **Database Safety Test**   | `packages/database/tests/migration-rollback-safety.mjs`   | Static analysis verifying non-destructive SQL and rollback semantics.             |
| **Error Hierarchy**        | `packages/errors/src/index.ts`                            | Canonical `AppError` classes, status codes, and type guards.                      |
| **Supabase Server**        | `packages/supabase/src/server.ts`                         | Server-side cookie-based Supabase client with query timing instrumentation.       |
| **Supabase Kysely**        | `packages/supabase/src/kysely.ts`                         | Type-safe Kysely database client for complex SQL aggregations.                    |
| **Supabase Browser**       | `packages/supabase/src/client.ts`                         | Browser Supabase client configured for on-prem LAN rewrite.                       |
| **Redis Cache**            | `packages/redis/src/cache.ts`                             | Two-tier L1 memory / L2 Redis cache manager with XFetch and tag invalidation.     |
| **Rate Limiter**           | `packages/rate-limiter/src/index.ts`                      | DI rate limiting engine with modular stores and strategies.                       |
| **Design Tokens**          | `packages/theme/src/tokens/index.ts`                      | Single source of truth for OKLCH tokens, glass refraction math, and radii.        |
| **Glass Component**        | `packages/ui/src/components/GlassCard.tsx`                | Primary card component adhering to strict light-mode glass refraction.            |
| **Offline Queue**          | `apps/portal/hooks/useOfflineQueue.ts`                    | Zustand persistent store queueing mutations during field connectivity drops.      |
| **Pit Connectivity**       | `libs/shared/hooks/src/usePitConnectivity.ts`             | Jittered heartbeat detector for mining pit network degradation and lie-fi.        |
| **Policy Compiler**        | `tools/repo/policy-compiler.cjs`                          | Monorepo boundary compiler generating ESLint boundaries and policy JSONs.         |
| **Compound Bash Guard**    | `tools/scripts/check-compound-bash.cjs`                   | AST parser blocking dangerous shell commands before execution.                    |
| **Quality Gates**          | `tools/scripts/enforce-quality-gates.sh`                  | 4-gate verification script (ARWR, tests, modernization, strict TS).               |
| **TODO & Report Protocol** | `.agents/rules/todo-completion-and-detailed-reporting.md` | Mandatory 100% TODO execution and detailed post-investigation reporting protocol. |
| **Structured Thinking**    | `.agents/rules/structured-thinking-mandate.md`            | Mandatory 5-phase thinking protocol (STM-0) for all agents before code mutations. |
| **Monorepo Topology**      | `pnpm-workspace.yaml`                                     | Defines workspace layout and centralized pnpm catalogs (`catalogs.react19`).      |
| **Task Pipeline**          | `turbo.json`                                              | Turborepo configuration for caching builds, tests, lints, and asset syncs.        |
| **Biome Config**           | `biome.json`                                              | Repository-wide formatting rules and linting presets.                             |

---

## Runtime/Tooling Preferences

### Primary Runtime & Package Manager

- **Node.js**: Strict engine requirement **`>=22`**. Pinned to **`24.15.0`** across `.node-version`, `.nvmrc`, and `package.json` Volta settings.
- **Package Manager**: **`pnpm`** (strictly pinned to **`9.15.9`** via `packageManager` and Volta).
  - Centralized dependency catalogs in `pnpm-workspace.yaml` (`catalog:`, `catalog:react19`).
  - **Hard Negative**: Do NOT use `bun`, `npm`, or `yarn` as the package manager or runtime.
- **Monorepo Task Runner**: **Turborepo 2.x** (`turbo`).

### Secondary Runtimes & Infrastructure

- **Python 3 (`>=3.10`)**: Used for:
  - Evaluation test suite in `packages/eval` (`poetry run pytest tests/` or `uv run pytest tests/`).
  - Network reachability checks: `python3 scripts/ensure_reachability.py`.
- **Rust / Cargo**: Used for the swarms orchestrator service at `tools/swarms-orchestrator` (`Cargo.toml` edition 2021).
- **Docker Compose**: Service definitions in `infra/docker/` (`compose.tools.yml`, `compose.ai-tools.yml`, `compose.portal.yml`). Note that production Redis configurations require `REDIS_PASSWORD`.

### Tooling & AST Safety Constraints

- **Biome** (`biome.json`): Primary repository linter and formatter.
- **Stylelint** (`stylelint.config.mjs`): Strictly enforces OKLCH tokens and forbids raw color literals or dark mode classes.
- **AST Bash Safety Gate**: Shell command chains are audited by `tools/scripts/check-compound-bash.cjs`. Never execute destructive bash commands (`rm -rf /`, `dd`, `chmod 777`, raw block device writes, or pipe-to-shell operations).
- **Conventional Commits**: Commit messages must follow the Conventional Commits specification, validated by Husky `commit-msg` and Commitlint (`config/tools/commitlint.config.mjs`).
- **Architectural Policy Compiler**: Monorepo boundaries are validated in CI via `pnpm policy:check`.

---

## Testing & QA

### Test Frameworks & Test Types

- **Unit & Integration**: **Jest 29/30** with `@swc/jest` (`apps/portal`, `packages/*`, `libs/*`).
  - `jsdom`: For React 19 UI components and hooks (`apps/portal/setupTests.ts` injects web API polyfills).
  - `node`: For backend packages (`@repo/contract`, `@repo/errors`, `@repo/rate-limiter`, `@repo/redis`). Server actions and API routes in `apps/portal` declare `/** @jest-environment node */` at the file top.
- **End-to-End (E2E) & Visual**: **Playwright Test** (`e2e/`) running against Chromium viewports with auth session caching.
- **Component Accessibility**: **Storybook Test Runner** + `axe-playwright` (`packages/ui`) automating WCAG compliance checks.
- **AI Evaluation**: **Pytest** + **DeepEval** (`packages/eval`) testing LLM outputs, factual consistency, and hallucination bounds.
- **Database Migrations**: Node.js test runner verifying rollback safety (`packages/database/tests/migration-rollback-safety.mjs`) and PostgreSQL psql scripts asserting RLS security policies.
- **Load & Performance**: **k6** (`k6/stress-test.js`) enforcing latency thresholds (`p(99) < 1500ms`, `rate < 0.01`).
- **Dynamic Security**: **OWASP ZAP** (`scripts/pentest.sh`) running containerized baseline penetration scans.

### Single-Source Unit Test Runner Invariant (Anti-Runner Fragmentation / Jest 30 SSoT)

- **Mandate**: All unit and integration testing across TypeScript packages (`apps/portal`, `packages/*`, `libs/*`) is strictly standardized on **Jest 30** with `@swc/jest`. Introducing fragmented secondary test runners (such as `ava`, `mocha`, or `tape`) is prohibited.
- **Hard Negatives**:
  - NEVER introduce `ava`, `mocha`, or alternative runner packages into `package.json` dependencies.
  - NEVER author test files with conflicting assertion syntax (e.g. AVA's `t.is`, `t.deepEqual`) outside standard Jest `expect()` and Playwright `expect()`.
  - NEVER fragment Turborepo test execution across incompatible CLI test runners.
- **Quality Gate**: Verified automatically via `pnpm audit:hooks` (part of `pnpm audit:compliance`).

### Test Execution Commands

```bash
# Run all unit/integration tests across all packages via Turborepo
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage collection
pnpm test:coverage

# Run tests in apps/portal only
pnpm --filter portal test

# Run a single isolated Jest test file in apps/portal
pnpm --filter portal test -- apps/portal/app/api/health/route.test.ts

# Run tests matching a specific name pattern
pnpm --filter portal test -- -t "submitShiftCloseout"

# Run tests for specific packages or libs
pnpm --filter @repo/errors test
pnpm --filter @repo/redis test
pnpm --filter @repo/contract test
pnpm --filter @repo/rate-limiter test
pnpm --filter @repo/database test

# Run Playwright E2E tests (requires server on :3000)
pnpm test:e2e

# Run Playwright visual regression smoke tests
pnpm test:e2e:visual

# Run Playwright in interactive UI mode
pnpm exec playwright test --ui --config=e2e/playwright.config.ts

# Update golden visual comparison snapshots
pnpm exec playwright test --config=e2e/playwright.config.ts --update-snapshots

# Run Storybook accessibility checks (axe-playwright)
pnpm test:a11y

# Run AI evaluation suite (DeepEval)
cd packages/eval && poetry run pytest tests/ -v
```

### Mocking Strategies & Invariants

- **Mock at Network Boundaries**: Mock external services at network client boundaries (`@repo/supabase/server`, `@repo/redis`, `fetch`). NEVER mock internal business logic or pure calculation functions.
- **Redis Mock**: Unit tests in `setupTests.ts` use an in-memory `Map` simulating Redis commands (`get`, `set`, `del`, `incr`, `expire`) to prevent socket timeouts.
- **Supabase Query Spies**: Mock Supabase using chained query builder spies (`.from().select().eq().single()`).
- **Next.js Cache Mocks**: In tests, `unstable_cache` passes through to the underlying callback `(cb) => cb`; `revalidatePath` and `revalidateTag` are mocked via `jest.fn()`.
- **E2E Auth Caching**: `e2e/global.setup.ts` completes a one-time login before test workers run and saves session credentials to `e2e/.auth/user.json`. Playwright browser contexts consume `storageState: 'e2e/.auth/user.json'`.
- **Database Safety Invariants**:
  - Migrations must strictly match `packages/database/migrations/NNN_description.sql` (3-digit zero-padded prefix).
  - Every new table must enable RLS on line 1 immediately following creation (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
  - Rollback safety verified by `packages/database/tests/migration-rollback-safety.mjs`.

### Jest Diagnostic Command Guard

When investigating Jest open handles (`--detectOpenHandles`) or diagnosing test lifecycle warnings:

1. **Distinguish Diagnostic Tooling Errors from Test Failures**: If a command fails with `Unknown option: 'detectOpenHandles'`, this is a `pnpm` CLI argument forwarding error, NOT a test failure. The underlying test results remain valid.
2. **No Code Mutations from CLI Argument Errors**: Do not modify application code merely because `--detectOpenHandles` was rejected by `pnpm`.
3. **Invoke Jest Directly**:
   ```bash
   pnpm --filter portal exec jest --runInBand --detectOpenHandles app/api/scada/tags/route.test.ts
   ```
4. **Or Forward Arguments Explicitly via `--`**:
   ```bash
   pnpm --filter portal test -- --detectOpenHandles app/api/scada/tags/route.test.ts
   ```
5. **Categorize Warning Root Cause**:
   - Real open handle (unclosed socket, active interval timer, persistent connection).
   - Jest config issue (e.g. `forceExit` artifact).
   - `pnpm` argument forwarding error.
   - Normal framework/runtime behavior (e.g. Node experimental warning).
6. **Do Not Weaken Tests**: Never weaken, skip, delete, or rewrite assertions to suppress warnings.
7. **No Arbitrary Suppression**: Do not add arbitrary Jest flags, configuration, timers, or process exits simply to suppress warnings.
8. **Target Genuine Leaks Only**: Only modify application/test infrastructure when the diagnostic output identifies an actual resource-lifecycle problem.
9. **Verify with Normal Test Command**: Re-run the standard test command afterward and confirm that all test suites pass.

### Coverage & Quality Gate Thresholds

Configured in `apps/portal/jest.config.cjs`:

- **Statements**: 40%
- **Branches**: 30%
- **Functions**: 30%
- **Lines**: 40%
- **Strategic Target**: Long-term strategy mandates critical mutations (Server Actions, RLS helper policies, Auth, AI provider failovers) reach 90%+ unit coverage.
- **Output Directory**: `apps/portal/coverage/` (HTML, LCOV, text summary).
