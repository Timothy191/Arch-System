# Contract Package (@repo/contract) — Agent Guidelines

## Scope & Purpose

The Single Source of Truth (SSoT) for all canonical Zod schemas, validation contracts, DTO types, and API parameter definitions across frontend and backend monorepo workspaces.

## Inner Loop Commands

- **Run all unit tests**: `pnpm nx test @repo/contract`
- **Run targeted schema test**: `pnpm --filter @repo/contract test -- -t "<schemaName>"`
- **Compile contract package**: `pnpm nx build @repo/contract` _(runs `tsc` producing `./dist/`)_
- **Type-check package**: `pnpm nx type-check @repo/contract`
- **Lint package**: `pnpm nx lint @repo/contract`
- **Verify schema drift**: `pnpm audit:drift` _(audits `@repo/database` migrations vs `@repo/contract` Zod schemas)_

## Architectural Invariants

- **Boundary Scope (`scope:package:contract`)**:
  - Zero runtime dependencies on application code (`apps/*`) or infrastructure adapters (`@repo/supabase`, `@repo/redis`).
  - Strict Data Contract SSoT: All data structures exchanged between clients, API routes, Server Actions, or database interfaces must define their schema here.
- **Contract Definition Rules**:
  - Every schema file under `src/schemas/` must export both the runtime Zod schema and its inferred TypeScript interface:
    ```typescript
    export const webhookConfigSchema = z.object({ ... });
    export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
    ```
  - Re-export schemas, DTOs, and inferred types through barrel exports in `src/index.ts`.
  - Deep path exports are configured in `package.json` (`./schemas/*`, `./types/*`, `./validation`) and mapped in root `tsconfig.base.json`. Always run `pnpm nx build @repo/contract` after adding or updating schemas so consumer packages resolve `./dist/` types.

## Agent Tracing

- Log all modifications, added schemas, and breaking contract migrations in `AGENT_TRACER.md` with an ISO 8601 timestamp.
- Use `// AGENT-TRACE: <explanation>` breadcrumbs when mapping non-obvious database JSONB columns or foreign constraints into Zod contracts.
