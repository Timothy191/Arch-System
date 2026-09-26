---
name: testing-rules
description: Standard guidelines, assertions, mocking strategies, and invariants for unit and integration tests.
paths:
  - "**/*.test.{ts,tsx}"
  - "**/*.spec.{ts,tsx}"
  - "apps/portal/jest.config.js"
  - "apps/portal/setupTests.ts"
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
