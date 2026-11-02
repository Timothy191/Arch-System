---
name: typescript-best-practices
description: TypeScript-specific best practices for type safety, strict mode, and avoiding common anti-patterns
paths:
  - 'apps/**/*.{ts,tsx}'
  - 'packages/**/*.{ts,tsx}'
  - 'libs/**/*.{ts,tsx}'
alwaysApply: true
---

# TypeScript Best Practices

## Strict Mode

- **Enable strict mode in tsconfig.json**: `"strict": true` enables strictNullChecks, noImplicitAny, and six other checks
- **No implicit any**: TypeScript should catch type errors at compile time, not runtime
- **Null safety**: Strict mode eliminates null reference bugs by requiring explicit null checks

## Type Safety

- **Avoid `any` type**: Use `unknown` for values of unknown shape, generics for type-consistent operations, or Zod validation for external data
- **Type assertions**: Only use `as Type` when you have a preceding type guard or runtime validation
- **API boundaries**: Validate external data with Zod schemas rather than asserting types
- **Discriminated unions**: Model multi-stage state as tagged unions (e.g., `{ status: 'loading' } | { status: 'success', data: T } | { status: 'error', error: Error }`)

## Modern Patterns

- **Modern array methods**: Prefer `.map()`, `.filter()`, `.reduce()`, `.find()`, `.some()`, `.every()` over for-loops
- **Const/let**: Use `const` by default, `let` only when reassignment is needed
- **Template literals**: Use backticks for string interpolation instead of concatenation
- **Optional chaining**: Use `?.` for safe property access instead of nested if-checks
- **Nullish coalescing**: Use `??` instead of `||` when you want to distinguish between null/undefined and falsy values

## Type-Only Imports

- **Use type-only imports**: `import type { Type } from './module'` for type-only imports to reduce bundle size
- **Separate imports**: Keep runtime imports and type imports in separate statements

## Error Handling

- **Typed errors**: Extend `AppError` from `@repo/errors` for domain errors
- **Error boundaries**: Use `isAppError(err)` to safely extract status codes at boundaries
- **Never swallow errors**: Every catch should return a typed fallback or rethrow with context

## Performance

- **Avoid type checks in hot paths**: Type assertions are compile-time only, but runtime type guards add overhead
- **Use readonly for immutable params**: Type inputs as `readonly` to prevent mutation
- **Prefer interfaces over types for object shapes**: Interfaces are extendable and better for object shapes; types are better for unions and computed types

## Arch-System Specific

- **Strict TypeScript already enforced**: Arch-System uses strict mode in all packages
- **No `any` policy**: The codebase has zero tolerance for `any` types
- **Zod validation**: All external data must be validated through `@repo/contract` schemas
