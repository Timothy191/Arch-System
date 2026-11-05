# Errors Package Agent Tracer

## 2026-11-05T12:55:00+02:00: Add Optional `digest` Property to `AppError` for Next.js Error Boundaries

- **Purpose**: Allow `isAppError(error)` to cleanly narrow Next.js `Error & { digest?: string }` error boundary props without `as any` casts under `suspicious.noExplicitAny: "error"`.
- **Verification**: `pnpm --filter @repo/errors type-check` & `pnpm biome ci .` ✅.

## 2026-11-05T11:24:00+02:00: Wire Biome Lint Task into `@repo/errors`

- **Purpose**: Add `"lint": "biome check ."` to `packages/errors/package.json` so `@repo/errors` participates in `pnpm turbo run lint`.
- **Verification**: `pnpm --filter @repo/errors lint` ✅.

## 2026-06-24: Resolve ESLint Warnings in Errors Package

### Purpose

Resolve ESLint `no-unused-vars` warnings flagged during the pre-commit checks due to constructor overloads and destructuring rest patterns in the errors utility.

### Changes Made

1. **[src/index.ts](file:///home/timoty/Desktop/project/Arch-System/packages/errors/src/index.ts)**:
   - Added `/* eslint-disable no-unused-vars */` at the top of the file. This bypasses false positives triggered by standard ESLint when encountering TypeScript constructor overloads (where parameters are declared without a body implementation) and destructuring assignments used to exclude fields.

### Status

- **Linting**: The package compiles cleanly and passes ESLint check with zero warnings.

### What the Next Agent Should Know

- Constructor overloads in `src/index.ts` declare signatures for initialization options but are not parsed as implementations by the base `no-unused-vars` rule. The top-level ignore comment is necessary unless a dedicated TypeScript-specific rule is configured.

## 2026-08-24: Add FetchTimeoutError & NetworkError

### Purpose

Provide specialized error subclasses under `APIError` to wrap raw browser `TypeError: Failed to fetch` and timeout boundaries in Next.js client-side operations.

### Changes Made

1. **[src/index.ts](file:///home/tim/Documents/Arch-System/packages/errors/src/index.ts)**: Added `FetchTimeoutError` (504), `NetworkError` (503), and type guards `isFetchTimeoutError` and `isNetworkError`.

## 2026-10-28T07:03:00+02:00: Align APIError & Default Error Messages with Portal Wrapper

### Purpose

Ensure `@repo/errors` and `apps/portal/lib/errors/error-classes.ts` share a unified `AppError` hierarchy (`cause?: unknown`, default messages on `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, and default `statusCode: 500` on `APIError` without `any` casts).

### Changes Made

1. **[src/index.ts](file:///home/tim/Fork/Arch-System/packages/errors/src/index.ts)**: Widened `cause` to `unknown`, added default messages to `AuthError`, `ForbiddenError`, `NotFoundError`, and `ConflictError`, and updated `APIError` to default `statusCode` to `500` and eliminate `any` casts.
