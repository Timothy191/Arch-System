---
name: execution-guardrails
description: Always-on pre-completion audits and quality gates for industrial-grade software
paths:
  - '**/*'
alwaysApply: true
---

# Autonomous Agent Execution Guardrails

## Real-World Production Mandate

Arch-System controls real mining operations. Every agent must:

- **Treat the repository as production-grade operational software** — never as a playground.
- **Strict Task Focus** — never explore unrelated code or files outside the user's explicit objective.
- **Assume real-world consequences** — a wrong RLS policy or migration can halt production.
- **Verify before claiming** — never assert "works" without empirical evidence (runtime tests, live probes).
- **Own the full lifecycle** — from design through deployment verification.

## Anti-Assumption Mandate (CRITICAL)

**NEVER guess, assume, or speculate about errors or issues.** Before claiming any error or blocker exists:

1. **Identify with empirical evidence** — Run the actual command (`pnpm build`, `pnpm type-check`, `pnpm lint`, `pnpm test`, or E2E).
2. **Provide the exact error output** — Quote the actual terminal output, log message, or exception trace without paraphrasing or relying on memory.
3. **Do not suggest fixes without evidence** — Reproduce the error, trace the root cause to specific code/config, and confirm with a test before fixing.

## Grounded Reasoning Mandate (CRITICAL)

**All reasoning, thoughts, and claims must be grounded in real-world proven data:**

1. **Ground premises in actual codebase state** — Read files, verify signatures/imports via AST (`codemap`, `ast-grep`), and check `git status`.
2. **Back claims with concrete evidence** — Reference specific files, commit hashes, measurements, or `package.json`/`pnpm-lock.yaml`.
3. **Label speculative reasoning explicitly** — Prefix hypotheticals with `HYPOTHETICAL: [reasoning]` and follow with empirical verification.
4. **Validate assumptions before building on them** — Prove or disprove assumptions with verification commands before proceeding.

## Mandatory Pre-Completion Audits

Before marking any task complete, autonomously execute:

1. `pnpm audit:drift`: Verifies database schema and `@repo/contract` Zod schema synchronization.
2. `pnpm audit:compliance`: Verifies SQL migrations, RLS policies, rollback safety, and design tokens.

## Essential Invariants

- **Zero-Padded Migrations**: SQL files in `packages/database/migrations/` must follow `NNN_description.sql`.
- **RLS Isolation**: RLS must be enabled on every table, consulting `(SELECT auth.uid())` and `public.employees`.
- **Architectural Boundaries**: `tools/repo/policy-compiler.cjs` is SSoT — UI packages pure presentation, apps route via `@repo/supabase`.
- **Tooling Drift**: If `pnpm policy:check` fails on generated files, run `pnpm policy:gen` to regenerate.
- **Agent Tracing**: Modified packages must append ISO 8601 entries to `AGENT_TRACER.md`.
- **Token & Bug Telemetry**: Record sessions via `pnpm token:record -- --agent <name> --input <n> --output <n> --bugs <n>` (or `pnpm agent:hook:post-task`).
- **System Overview (`/overview`) Parity**: When adding migrations, routes, quality gates, or updating expenditure telemetry, keep `apps/portal/app/overview/` (`lib/data.ts`, `DatabaseSchema.tsx`, `TechStack.tsx`, `SystemArchitecture.tsx`, `OverviewHeaderVisuals.tsx`, `agentic-monitor-data.ts`) synchronized (`213` migrations, `27/27` gates, `PROJECT_MILESTONES` summing to `LIFETIME_METRICS` in `en-US` period format `R 5,000.00`).
- **Backlog Zero & Anti-Bloat Leases**: Complete outstanding tasks before new work; use `skills-mcp` acquire/return for dynamic context leasing.

## Fast Inner-Loop

- Run targeted unit tests first: `pnpm --filter portal test -- --testPathPatterns="<name>"`.
- Keep dev server active; avoid heavy monorepo builds in interactive sessions.
