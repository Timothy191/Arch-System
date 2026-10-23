---
name: testing-rules
description: 'Canonical JavaScript/TypeScript & Node.js testing standards (distilled from javascript-testing-best-practices & nodebestpractices): Jest 30 + @swc/jest and Playwright SSoT, AAA structure, black-box behavior assertions, boundary-only mocking, and typed AppError verification.'
paths:
  - '**/*.test.{ts,tsx,mjs}'
  - '**/*.spec.{ts,tsx}'
  - 'apps/portal/jest*.config.cjs'
  - 'apps/portal/setupTests.ts'
  - 'e2e/**/*'
---

# Testing Standards & Mocking Rules

When writing or modifying unit, integration, or E2E tests across `apps/`, `packages/`, `libs/`, and `e2e/`:

1. **Standardize on Jest 30 (`@swc/jest`) & Playwright (Zero Runner Fragmentation)**:
   - Unit and integration suites run on **Jest 30** compiled via `@swc/jest` (`apps/portal/jest.config.cjs`), while E2E and visual regression suites run on **Playwright** (`e2e/playwright.config.ts`).
   - Alternative test runners (`ava`, `mocha`, `tape`) are strictly forbidden and blocked by `node tools/audits/audit-hooks-and-clients.cjs` (`pnpm audit:hooks`).
2. **Structure Every Test with Arrange-Act-Assert (AAA)**:
   - Clearly separate **Arrange** (fixtures, mocks, render), **Act** (user interaction, route handler call, or RPC invocation), and **Assert** (observable outcomes).
   - Name tests by behavior (`should <expected outcome> when <condition>` or `it('returns 429 RATE_LIMIT_EXCEEDED when per-machine drill ingest cap is exceeded', ...)`) stating the unit under test, scenario, and expected outcome.
3. **Test Observable Behavior, Never Private Implementation Details**:
   - Query DOM elements by accessible role, label, text, or explicit `data-testid` (`getByRole`, `getByLabelText`, `getByTestId`), never brittle CSS selector chains or internal component state.
   - Assert utility classes with `expect(el).toHaveClass('scale-125', 'text-amber-400')` (which is order-independent and compatible with Biome `useSortedClasses`) rather than raw `el.className` string equality.
4. **Mock Only External I/O Boundaries (`setupTests.ts`)**:
   - Mock network, Supabase, Redis, AI agents, or browser APIs at module boundaries (`apps/portal/setupTests.ts` mocks `next/cache`, `@repo/redis`, `@repo/agents`, `matchMedia`, `IntersectionObserver`, `ResizeObserver`, and enforces `process.env.DISABLE_RATE_LIMIT = 'false'`) or via factory injection.
   - Never mock internal pure domain logic or `@repo/contract` Zod schemas.
   - Pair mocked unit suites with real-service integration tests for stateful primitives (`REDIS_INTEGRATION=1` for Lua/Streams in `apps/portal/test/integration/` and `@repo/redis`, plus migration rollback-safety and offline-mutation security via `pnpm --filter @repo/database test`).
5. **Assert Typed `AppError` Subclasses & Edge Paths Explicitly**:
   - Every Server Action, DAL helper, and API route test suite must verify both the happy path and failure modes using typed `@repo/errors` subclasses (`ValidationError` 400, `AuthError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `RateLimitError` 429, `DatabaseError` 500, `APIError`/`NetworkError`/`FetchTimeoutError` 502/503/504) and type guards (`isAppError`).
6. **Playwright E2E & Visual Regression Hygiene**:
   - Multi-viewport Chromium projects (`chromium`, `mobile-chrome`, `tablet-chrome`) reuse authenticated storage state (`e2e/.auth/user.json`), forbid `.only` in CI (`forbidOnly: !!process.env.CI`), and enforce deterministic visual snapshot diffs (`maxDiffPixelRatio: 0.02`).

See `skill://testing-rules` for full protocol details.
