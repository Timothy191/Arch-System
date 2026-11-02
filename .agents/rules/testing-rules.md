---
name: testing-rules
description: 'Jest 30, @swc/jest, Playwright SSoT, AAA structure, boundary-only mocking, and typed AppError verification.'
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
   - Unit and integration suites run on **Jest 30** compiled via `@swc/jest` (`apps/portal/jest.config.cjs`); E2E and visual regression run on **Playwright** (`e2e/playwright.config.ts`).
   - Alternative test runners (`ava`, `mocha`, `tape`) are strictly forbidden (`pnpm audit:hooks`).
2. **Structure Every Test with Arrange-Act-Assert (AAA)**:
   - Clearly separate **Arrange** (fixtures, mocks, render), **Act** (invocation), and **Assert** (observable outcomes).
   - Name tests by behavior (`should <expected outcome> when <condition>`) stating unit under test, scenario, and expected outcome.
3. **Test Observable Behavior, Never Private Implementation Details**:
   - Query DOM elements by accessible role, label, text, or `data-testid` (`getByRole`, `getByLabelText`, `getByTestId`), never brittle CSS selector chains.
   - Assert utility classes with `expect(el).toHaveClass('scale-125', 'text-amber-400')` (compatible with Biome `useSortedClasses`).
4. **Mock Only External I/O Boundaries (`setupTests.ts`)**:
   - Mock network, Supabase, Redis, AI agents, or browser APIs at module boundaries (`apps/portal/setupTests.ts` mocks `next/cache`, `@repo/redis`, `@repo/agents`, browser observers; enforces `process.env.DISABLE_RATE_LIMIT = 'false'`).
   - Never mock internal pure domain logic or `@repo/contract` Zod schemas.
   - Pair mocked unit suites with real-service integration tests for stateful primitives (`REDIS_INTEGRATION=1` in `@repo/redis`, rollback-safety in `@repo/database`).
5. **Assert Typed `AppError` Subclasses & Edge Paths Explicitly**:
   - Verify happy path and failure modes using typed `@repo/errors` subclasses (`ValidationError` 400, `AuthError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `RateLimitError` 429, `DatabaseError` 500, `APIError`/`NetworkError`/`FetchTimeoutError` 502/503/504) and `isAppError`.
6. **Playwright E2E & Visual Regression Hygiene**:
   - Multi-viewport Chromium projects (`chromium`, `mobile-chrome`, `tablet-chrome`) reuse auth state (`e2e/.auth/user.json`), forbid `.only` in CI (`forbidOnly: true`), and enforce deterministic visual snapshots (`maxDiffPixelRatio: 0.02`).
7. **Severity-Tiered Testing (Risk Model)**:
   - **Class 1 (Safety/SCADA/RLS)**: 100% boundary tests, rollback safety, and real Redis stream execution.
   - **Class 2 (Server Actions/Cache)**: Network-boundary mocks and typed `AppError` assertions.
   - **Class 3 (UI Presentation)**: Storybook a11y (`test:a11y`) and Playwright visual snapshots.
8. **Fixed Read-Only Test Harness Invariant**:
   - The judge is never an agent. Agents propose changes; agents NEVER grade their own work or weaken test assertions.
   - Verification harnesses (`agent-verify.sh`, linters, policy compiler) are immutable; modifying thresholds to simulate a pass is strictly prohibited.
9. **Empirical Win Reproduction Protocol**:
   - Any claimed performance optimization (P50/P95 latency, query duration, token reduction) must be empirically reproduced across at least 2 consecutive benchmark runs against baseline before acceptance.
10. **Evidence Receipts**:

- Write JUnit XML and NDJSON evidence to `.ci-local/agent-verify-evidence.json` on verification.

See `skill://testing-rules` for full protocol details.
