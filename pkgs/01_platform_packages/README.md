# Packages

This directory contains shared packages for the Arch Systems monorepo. Each package has a single responsibility and is versioned independently.

## Package Overview

| Package                   | Purpose                                                                    | Consumers                   | Notes                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/contract`          | API type definitions and validation schemas using Zod                      | apps/portal, other packages | Contains schemas for admin, AI, control-room, export, forms, scanner, sync, telemetry, and webhooks. Source of truth for shared TypeScript types across frontend/backend.                                     |
| `@repo/database`          | SQL migrations (source of truth)                                           | apps/portal (via Supabase)  | Migration files are the canonical schema definition. Never edit `pkgs/supabase/supabase/migrations/` directly.                                                                                            |
| `@repo/errors`            | Structured error classes with context and cause tracking                   | apps/portal                 | Provides 8 error classes: AppError, ValidationError, AuthError, ForbiddenError, NotFoundError, ConflictError, APIError, DatabaseError, RateLimitError. Includes type guard functions for safe error handling. |
| `@repo/eslint-config`     | Shared ESLint configurations                                               | All pkgs/apps           | Provides `library.js`, `next.js`, and `react-internal.js` configurations. Tooling package.                                                                                                                    |
| `@repo/eval`              | LLM evaluation suite for AI service quality and code generation compliance | CI/CD                       | Python/DeepEval framework. Tests AI service outputs and code generation against golden cases and compliance metrics (RLS completeness, design system, import patterns). Not part of `pnpm quality`.           |
| `@repo/rate-limiter`      | Rate limiting with multiple strategies and stores                          | apps/portal (potentially)   | Supports fixed-window, sliding-window, and token-bucket strategies. Includes memory and Redis stores. Uses dependency injection—does NOT depend on @repo/redis.                                               |
| `@repo/redis`             | Redis client, caching helpers, cache stats, TTL registry                   | apps/portal                 | Provides department slug resolution caching and general cache utilities. Includes cache hit/miss stats and tag-based invalidation.                                                                            |
| `@repo/supabase`          | Supabase clients and type-safe query builders                              | apps/portal                 | Exports browser, server, middleware, read-replica, and service-role clients. Includes Kysely integration for type-safe queries.                                                                               |
| `@repo/theme`             | OKLCH design tokens, Tailwind preset, CSS variables                        | @repo/ui, apps/portal       | Single source of truth for design tokens. Uses Style Dictionary for code generation to `tokens/generated.ts`. Edit `tokens.json` → run build.                                                                 |
| `@repo/typescript-config` | Shared TypeScript configuration                                            | All pkgs/apps           | Tooling package. Ensures consistent TS settings across the monorepo.                                                                                                                                          |
| `@repo/ui`                | Shared Radix/shadcn UI components                                          | apps/portal                 | Component library depends on `@repo/theme` for design tokens. Exports Glass cards, animated components, data grids, workflow builders, and more.                                                              |
| `@repo/utils`             | Utility functions for third-party integrations                             | apps/portal                 | Provides helpers for Novu notifications, Inngest workflows, and Excel exports. Pure functions with no business logic.                                                                                         |

## Dependency Graph

### Runtime Packages

```
@repo/theme
  └─ @repo/ui
      └─ apps/portal

@repo/errors
  └─ apps/portal

@repo/redis
  └─ apps/portal

@repo/supabase
  └─ apps/portal

@repo/contract
  └─ apps/portal

@repo/utils
  └─ apps/portal

@repo/rate-limiter
  └─ (optional for apps/portal, uses dependency injection)
```

### Tooling Packages

```
@repo/eslint-config → All pkgs/apps
@repo/typescript-config → All pkgs/apps
```

## Key Design Decisions

### @repo/redis vs @repo/rate-limiter

These packages are **separate by design**:

- `@repo/redis` provides a concrete Redis client and caching utilities (used by portal for department slug resolution)
- `@repo/rate-limiter` provides a generic rate limiting framework with dependency injection—it can work with any Redis client implementation
- `@repo/rate-limiter` does NOT depend on `@repo/redis`; it defines its own `SimpleRedisClient` interface
- This separation allows rate limiting to be used in contexts that may have different Redis client requirements

### @repo/errors

This package is **intentionally separate**:

- 334 lines with 8 error classes and type guard functions
- Provides structured error handling with context, cause, and HTTP status codes
- Not "small" enough to justify merging into utils or contract
- Used by apps/portal for consistent error handling across the application

### @repo/contract vs @repo/types

- `@repo/contract` holds API contracts (Zod schemas + TypeScript types) for data validation and type safety across frontend/backend
- The package name uses "contract" to indicate it defines the "shape of data" that flows between systems, not blockchain smart contracts

### Tooling Package Placement

- `@repo/eslint-config` and `@repo/typescript-config` are in the flat packages structure
- If more tooling packages are added (e.g., jest-config, pretttier-config), consider grouping them under a `tooling/` or `toolchain/` directory

## Adding a New Package

1. Create the package directory: `pkgs/<package-name>/`
2. Add a `package.json` with proper `name`, `version`, `exports`, and `description` fields
3. Add the package to `pnpm-workspace.yaml` if not using the `pkgs/*` pattern
4. Add a description to the table in this README
5. Run `pnpm install` to link workspace dependencies
6. Update consumers (apps/portal or other packages) to import from the new package

## Code Generation Workflows

### Design Tokens (@repo/theme)

1. Edit `pkgs/theme/tokens.json`
2. Run `pnpm --filter @repo/theme build`
3. Commit both `tokens.json` and `pkgs/theme/src/tokens/generated.ts`

### Database Types (@repo/database → @repo/supabase)

1. Add migration to `pkgs/database/migrations/NNN_description.sql`
2. Run `pnpm --filter @repo/database supabase:push`
3. Run `pnpm --filter @repo/database supabase:gen`
4. Commit migration + updated `pkgs/supabase/src/database.types.ts`

## Package Entry Points

All packages should have:

- `main`: Path to the main entry point (e.g., `./src/index.ts` or `./dist/index.js`)
- `types`: Path to TypeScript declaration files (e.g., `./src/index.ts` or `./dist/index.d.ts`)
- `exports`: Export map for subpath exports (e.g., `./server`, `./client`)

See individual `package.json` files for the complete export configuration.

## Verification

- Run `pnpm knip` to detect dead code and dependency issues
- Run `pnpm deps:lint` to check for dependency version inconsistencies
- Run `pnpm nx run-many -t lint type-check` to verify all packages type-check correctly
