---
name: testing-rules
description: 'Canonical JavaScript/TypeScript & Node.js testing standards (distilled from javascript-testing-best-practices & nodebestpractices): AAA structure, black-box behavior assertions, boundary-only mocking, and class-order-independent DOM checks.'
paths:
  - '**/*.test.{ts,tsx,mjs}'
  - '**/*.spec.{ts,tsx}'
  - 'apps/portal/jest*.config.cjs'
  - 'apps/portal/setupTests.ts'
---

# Testing Standards & Mocking Rules

When writing or modifying unit, integration, or E2E tests across `apps/`, `packages/`, and `libs/`:

1. **Structure Every Test with Arrange-Act-Assert (AAA)**:
   - Clearly separate **Arrange** (fixtures, mocks, render), **Act** (user interaction, route handler call, or RPC invocation), and **Assert** (observable outcomes).
   - Test titles must state the unit under test, scenario, and expected outcome (`it('returns 429 RATE_LIMIT_EXCEEDED when per-machine drill ingest cap is exceeded', ...)`).
2. **Test Observable Behavior, Never Implementation Details**:
   - Query DOM elements by accessible role, label, text, or explicit `data-testid` (`getByRole`, `getByLabelText`, `getByTestId`), never brittle CSS selector chains.
   - Assert utility classes with `expect(el).toHaveClass('scale-125', 'text-amber-400')` (which is order-independent and compatible with Biome `useSortedClasses`) rather than raw `el.className` string equality.
3. **Mock Only External/IO Boundaries**:
   - Mock network, Supabase, Redis, or browser APIs at module boundaries (`setupTests.ts` or factory injection), never internal pure functions or Zod schemas (`@repo/contract`).
   - Pair mocked unit suites with real-service integration tests for stateful primitives (`REDIS_INTEGRATION=1` for Lua/Streams in `apps/portal/test/integration/` and `test:migration-replay` in `@repo/database`).
4. **Verify Error & Edge Paths Explicitly**:
   - Every Server Action and API route test suite must cover both the happy path and failure modes (`ValidationError` 400, `AuthError` 401, `ForbiddenError` 403, `RateLimitError` 429, and upstream RPC/DB failures).

See `skill://testing-rules` for full protocol details.
