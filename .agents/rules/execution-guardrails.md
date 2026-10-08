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

---

## 6. Tooling Drift Resolution

- Running `pnpm format` will format auto-generated policy files and break the strict drift verification. If `pnpm policy:check` or `agent:verify` fails due to drift on generated files (e.g., `eslint-boundaries.generated.cjs`), you **MUST** autonomously run `pnpm policy:gen` to regenerate them and realign the pipeline before proceeding.

## 7. Finish What You Start Invariant

- **Strict Completion Enforcement**: Nothing new may be added or started until all past or outstanding actions, tasks, or other requirements are fully completed. You must always finish what you start before moving on to parallel integrations or new feature mappings.

## 8. Backlog Zero Invariant

- **Mandatory Backlog Check**: At the start of new sessions or when switching contexts, you must autonomously check for any backlog, unfinished tasks, or incomplete `temp/tasks.md` items.
- **Autonomous Completion**: If an outstanding backlog is detected, you must prompt/inform the user and immediately autonomously complete the required tasks. You must maintain a "zero outstanding" state so you can assist the user with new requests without forgotten or hanging tasks.

## 9. Anti-Bloat Dynamic Leases via `skills-mcp`

- **No Static Context Flooding**: Agents MUST NOT inject entire markdown skill manuals, architectural guides, or schemas into prompts or persistent system rules.
- **Lease-and-Return Lifecycle**:
  1. Inspect metadata via `list_available_skills` or `list_available_context`.
  2. Lease the active instructions via `acquire_skill(skillName, agentId)` or `acquire_context(contextId, agentId)`.
  3. Execute the scoped subtask.
  4. Promptly invoke `return_skill` / `release_context` upon completion to release tokens and unbloat the agent context window.
