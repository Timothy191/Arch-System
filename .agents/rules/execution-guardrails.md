# Autonomous Agent Execution Guardrails

This rule is permanently and autonomously active across all agent sessions operating within this codebase.

---

## 1. Automated Compliance & Drift Mandate

Before marking any task, feature, or refactor complete, the agent **MUST autonomously execute**:

1. `pnpm audit:drift`: Verifies that database schema definitions and `@repo/contract` Zod schemas remain 100% synchronized.
2. `pnpm audit:compliance`: Verifies all 110 SQL migrations, RLS policies, rollback safety (`@repo/database:test:migration-rollback`), and design tokens.

---

## 2. Fast Inner-Loop Feedback Before Monorepo Gates

- When editing components, server actions, or feature hooks, **always** run targeted unit tests first:

  ```bash
  pnpm --filter portal test -- --testPathPatterns="<name>"
  ```

- Do not run heavy monorepo builds or production builds (`next build`) inside interactive agent sessions; always keep the development server (`pnpm dev` or `pnpm dev:quick`) active to preserve Hot Module Replacement (HMR).

---

## 3. Data & Migration Invariants

- **Zero-Padded Migrations**: SQL files in `packages/database/migrations/` must follow `NNN_description.sql`.
- **Mandatory Rollback Tests**: Any modification to database migrations requires running:

  ```bash
  pnpm --filter @repo/database test
  ```

- **RLS Isolation**: RLS must be enabled on every table, strictly consulting `auth.uid()` and cross-referencing `public.employees`.

---

## 4. Architectural Boundaries (SSoT)

- `tools/repo/policy-compiler.cjs` is the Single Source of Truth for monorepo scope tags:
  - UI packages (`@repo/ui`) must remain pure presentation—no direct database or Supabase imports.
  - Apps cannot import `@repo/database-internal`; queries flow through `@repo/supabase`.
  - Feature modules cannot import app packages.

---

## 5. Agent Tracing & Context Handover

- Every modified package or application root contains an `AGENT_TRACER.md`.
- Assistants must append an ISO 8601 timestamped entry documenting changes, reasons, and next-agent handover notes.
- Complex logic must include inline `// AGENT-TRACE: <explanation>` breadcrumbs.
