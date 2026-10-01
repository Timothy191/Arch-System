---
name: testing-rules
description: Standard guidelines, assertions, mocking strategies, and invariants for unit and integration tests.
paths:
  - '**/*.test.{ts,tsx}'
  - '**/*.spec.{ts,tsx}'
  - 'apps/portal/jest.config.js'
  - 'apps/portal/setupTests.ts'
---

# Testing Standards & Mocking Rules

## 1. Core Testing Philosophy

- **Unit Isolation**: Unit tests must execute in isolation without relying on live external networks or persistent databases.
- **Network Boundary Mocking**: Always mock at the network client boundary (e.g., Supabase client, Redis client), never at internal business logic functions.
- **Co-location**: Unit tests must be co-located with their target implementation files (e.g. `foo.ts` -> `foo.test.ts`).

## 2. Naming & Assertion Conventions

- Use descriptive BDD test names: `describe('<ComponentOrUtility>', () => { it('should <expected behavior> when <condition>', () => { ... }) })`.
- Maintain focused assertions testing both normal flow, edge cases (empty arrays, undefined params, boundary numbers), and error propagation (`isAppError`).

## 3. Mocking Invariants in Arch-System

- **Redis Mocking**: Use the global in-memory `Map` mock (`get`, `set`, `del`, `incr`, `expire`) defined in `setupTests.ts`.
- **Supabase Mocking**: Use chained query builder spies:
  ```typescript
  const mockFrom = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: [...], error: null }),
  });
  ```
- **Error Assertion**: Verify error throwing subclasses `@repo/errors` (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`).

## 4. Jest Diagnostic Command Guard

When investigating Jest open handles or diagnosing test lifecycle warnings:

1. **Treat Successful Tests as Valid**: Do not treat tooling/argument errors as test failures. A test run reporting passed suites and tests remains valid.
2. **No Code Mutations from CLI Argument Errors**: Do not modify application logic merely because `--detectOpenHandles` (or another Jest option) was rejected by `pnpm`.
3. **Invoke Jest Directly**:
   ```bash
   pnpm --filter portal exec jest --runInBand --detectOpenHandles app/api/scada/tags/route.test.ts
   ```
4. **Or Forward Arguments Explicitly**:
   ```bash
   pnpm --filter portal test -- --detectOpenHandles app/api/scada/tags/route.test.ts
   ```
5. **Categorize the Resulting Warning**:
   - Actual open-handle diagnosis (active connection/timer)
   - Jest configuration issue (e.g. `forceExit` artifact)
   - `pnpm` argument-forwarding issue
   - Normal framework/runtime behavior (e.g. Node experimental warning)
6. **No Test Weakening**: Do not weaken, skip, delete, or rewrite tests to eliminate warnings.
7. **No Arbitrary Suppression**: Do not add arbitrary Jest flags, timers, or process exits simply to suppress warnings.
8. **Targeted Lifecycle Fixes Only**: Only change application or test infrastructure when diagnostic output identifies a genuine resource-lifecycle leak.
9. **Verify with Standard Test Command**: Re-run the standard test command afterward and confirm expected pass counts.

- **Server Actions Mocking**: When a Client Component is refactored to use Server Actions for database mutations to comply with Architectural Boundaries, you **must** update its associated unit tests to mock the Server Action file directly (e.g., `jest.mock('./actions')`) rather than mocking the Supabase client (`createBrowserSupabaseClient`). Do not assert on `mockSupabase.from()` if the component calls a Server Action.
