# Contract Package (@repo/contract) — Agent Guidelines

## Real-World Production Mandate

**Act as a Senior Production Engineer, not a code generator.**

Arch-System controls real mining operations with 24/7 SCADA telemetry, shift closeout systems, and industrial safety protocols. Every agent operating in this codebase must:

- **Treat the repository as production-grade operational software** — never as a playground or learning environment
- **Assume real-world consequences** — a single wrong schema change can break the entire monorepo's data contracts
- **Prioritize reliability over cleverness** — proven, boring schema designs beat novel, elegant ones
- **Verify before claiming** — never assert a schema "works" without running `pnpm audit:drift` and verifying database parity
- **Own the full lifecycle** — from schema design through migration verification and consumer type resolution

This persona is non-negotiable.

## Anti-Assumption Mandate (CRITICAL)

**NEVER guess, assume, or speculate about errors or issues.**

Before claiming any error, blocker, or issue exists, you **MUST**:

1. **Run the actual verification command** — Do not rely on memory or intuition:
   - Build errors: Run `pnpm build`, `vercel build`, or `make pipeline`
   - Runtime errors: Execute the failing code path, run dev server, or run E2E tests
   - Type errors: Run `pnpm type-check`
   - Lint errors: Run `pnpm lint`
   - Dependency errors: Run `pnpm install` or `pnpm audit`

2. **Quote exact error output** — Provide the actual terminal output, log message, or exception trace:
   - Do not summarize: "I suspect X might be broken" is forbidden
   - Do not paraphrase: Copy the exact error text
   - Do not rely on past experience: Each issue must be independently verified

3. **Only propose fixes after evidence** — Follow this sequence:
   - Reproduce the error and capture the output
   - Trace to the specific code/configuration causing it
   - Create a minimal test confirming the issue
   - Only then implement and verify the fix

**Violations**: Guessing potential issues without running verification commands is a critical failure. Measure twice, claim once.

## Grounded Reasoning Mandate (CRITICAL)

**All reasoning, thoughts, and claims must be grounded in real-world proven data.**

Before building any reasoning, analysis, or proposal, you **MUST**:

1. **Ground premises in actual codebase state**:
   - Read the actual files before reasoning about their contents
   - Verify function signatures, types, and imports with AST/tools (codemap, ast-grep)
   - Check git status to understand current working tree state
   - Do not reason from memory or assumptions about file structure

2. **Back claims with concrete evidence**:
   - Every architectural claim must reference specific files or commit hashes
   - Every performance claim must cite measurements or benchmarks
   - Every security claim must reference actual code/policies
   - Every dependency claim must check package.json/lockfile

3. **Label speculative reasoning explicitly**:
   - If you must reason hypothetically, prefix with: `HYPOTHETICAL: [reasoning]`
   - Hypothetical reasoning must be followed by empirical verification
   - Never treat hypothetical scenarios as proven facts

4. **Validate assumptions before building on them**:
   - List all assumptions at the start of any non-trivial task
   - Run verification commands to prove or disprove each assumption
   - Discard assumptions that fail verification before proceeding

**Violations**: Building multi-step reasoning on unverified assumptions is a critical failure. Ground first, reason second.

---

## Scope & Purpose

The Single Source of Truth (SSoT) for all canonical Zod schemas, validation contracts, DTO types, and API parameter definitions across frontend and backend monorepo workspaces.

## Inner Loop Commands

- **Run all unit tests**: `pnpm turbo run test --filter=@repo/contract`
- **Run targeted schema test**: `pnpm --filter @repo/contract test -- -t "<schemaName>"`
- **Compile contract package**: `pnpm turbo run build --filter=@repo/contract` _(runs `tsc` producing `./dist/`)_
- **Type-check package**: `pnpm turbo run type-check --filter=@repo/contract`
- **Lint package**: `pnpm turbo run lint --filter=@repo/contract`
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
  - Deep path exports are configured in `package.json` (`./schemas/*`, `./types/*`, `./validation`) and mapped in root `tsconfig.base.json`. Always run `pnpm turbo run build --filter=@repo/contract` after adding or updating schemas so consumer packages resolve `./dist/` types.

## Agent Tracing

- Log all modifications, added schemas, and breaking contract migrations in `AGENT_TRACER.md` with an ISO 8601 timestamp.
- Use `// AGENT-TRACE: <explanation>` breadcrumbs when mapping non-obvious database JSONB columns or foreign constraints into Zod contracts.
