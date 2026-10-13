---
name: execution-guardrails
description: Always-on pre-completion audits and quality gates for industrial-grade software
paths:
  - '**/*'
alwaysApply: true
---

# Autonomous Agent Execution Guardrails

This rule is permanently and autonomously active across all agent sessions.

## Real-World Production Mandate

Arch-System controls real mining operations. Every agent must:

- **Treat the repository as production-grade operational software** — never as a playground
- **Assume real-world consequences** — a single wrong RLS policy or migration can halt production
- **Verify before claiming** — never assert "works" without empirical evidence (runtime tests, live probes)
- **Own the full lifecycle** — from design through deployment verification

## Anti-Assumption Mandate (CRITICAL)

**NEVER guess, assume, or speculate about errors or issues.**

Before claiming any error, blocker, or issue exists, the agent **MUST**:

1. **Identify with empirical evidence** — Run the actual command that would fail:
   - Build errors: Run `pnpm build`, `vercel build`, or `make pipeline`
   - Runtime errors: Run the dev server, execute the failing code path, or run E2E tests
   - Dependency errors: Run `pnpm install`, `pnpm audit`, or check lockfile
   - Type errors: Run `pnpm type-check` (never guess from memory)
   - Lint errors: Run `pnpm lint` (never guess from memory)

2. **Provide the exact error output** — Quote the actual terminal output, log message, or exception trace
   - Do not summarize or paraphrase errors
   - Do not say "might be X" or "could be Y"
   - Do not rely on memory of similar past issues

3. **Do not suggest fixes without evidence** — Only propose solutions after:
   - The actual error is reproduced and captured
   - The root cause is traced to specific code/configuration
   - A minimal test confirms the issue

**Violations**: Stating "I suspect X might be broken" without running the actual verification command is a critical failure. Always measure twice, claim once.

## Grounded Reasoning Mandate (CRITICAL)

**All reasoning, thoughts, and claims must be grounded in real-world proven data.**

Before building any reasoning, analysis, or proposal, the agent **MUST**:

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

## Mandatory Pre-Completion Audits

Before marking any task complete, the agent **MUST autonomously execute**:

1. `pnpm audit:drift`: Verifies database schema and `@repo/contract` Zod schema synchronization
2. `pnpm audit:compliance`: Verifies SQL migrations, RLS policies, rollback safety, and design tokens

## Essential Invariants

- **Zero-Padded Migrations**: SQL files in `packages/database/migrations/` must follow `NNN_description.sql`
- **RLS Isolation**: RLS must be enabled on every table, consulting `auth.uid()` and `public.employees`
- **Architectural Boundaries**: `tools/repo/policy-compiler.cjs` is SSoT — UI packages pure presentation, apps route via `@repo/supabase`
- **Tooling Drift**: If `pnpm policy:check` fails on generated files, run `pnpm policy:gen` to regenerate
- **Agent Tracing**: Modified packages must append ISO 8601 entries to `AGENT_TRACER.md`
- **Backlog Zero**: Check and complete outstanding tasks before starting new work
- **Anti-Bloat Leases**: Use `skills-mcp` acquire/return for dynamic context leasing

## Fast Inner-Loop

- Run targeted unit tests first: `pnpm --filter portal test -- --testPathPatterns="<name>"`
- Keep dev server active; avoid heavy monorepo builds in interactive sessions
