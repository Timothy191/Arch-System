# AGENTS.md — `/home/tim/Fork` (Federated Workspace Root)

Scope: workspace root only. Each service has its own `AGENTS.md`; read it before touching that service. Root `CLAUDE.md` is a symlink to this file (single source of truth).

## 0. Session Bootstrap (do this before any command)

**`node`, `pnpm`, `npm` are not on `PATH`.** Every bare `node`/`pnpm`/`npm` call fails with `command not found`. Do not reinstall a toolchain and do not try to repair `~/.local/share/mise/shims` — those shims are **dangling symlinks** (they point at `/usr/bin/mise`, which no longer exists). The real toolchains are intact under `~/.local/share/mise/installs/`:

```bash
# Node 24 everywhere (matches Arch-System engines: node >=24) + pnpm from the 26.8.1 tree
export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$PATH"
node -v   # v24.15.0
```

The 24.15.0 tree ships `node`/`npm`/`npx` only; the 26.8.1 tree supplies `pnpm` (and `tsc`, `lighthouse`, `vercel`, `repomix`). Drop the 24.15.0 entry if you specifically need node 26.

**pnpm version is directory-dependent** (corepack resolves the nearest `packageManager`):

| Directory                        | `pnpm -v`  | Why it matters                                                   |
| :------------------------------- | :--------- | :--------------------------------------------------------------- |
| `Arch-System/`                   | **9.15.9** | Hard-pinned in its `package.json`; other versions hang Turborepo |
| `Arch-System/apps/portal/`, root | 12.6.0     | No `packageManager` field                                        |

Do not run `mise activate` / `eval "$(mise activate bash)"` — there is no `mise` binary.

## Essential Commands

From `Arch-System/`:

- `pnpm dev` — Full dev system (0.0.0.0:3000)
- `pnpm dev:quick` — Headless quick boot
- `pnpm dev:turbo` — Portal dev via Turborepo
- `pnpm build` — Full Turborepo build
- `pnpm type-check` — Workspace TypeScript check
- `pnpm lint` — Linting (Biome)
- `pnpm quality` — Full quality gate
- `pnpm agent:verify` — MANDATORY verification before completing any task
- `pnpm audit:browser` — Closed-loop browser, devtools & a11y probe
- `pnpm test` — All unit tests (Jest 30 SSoT)
- `pnpm --filter portal test` — Portal unit tests
- `pnpm test -- <path/to/file.test.ts>` — Specific test file
- `pnpm test:e2e` — Playwright E2E (:3000)
- `pnpm test:a11y` — Storybook accessibility tests
- `pnpm --filter @repo/database db:types` — Regenerate Supabase types
- `pnpm db:seed` — Seed dev database
- `pnpm --filter @repo/database supabase:start` — Start local Supabase
- `pnpm --filter @repo/database supabase:reset` — Reset local database
- `./setup.sh --dev` — One-command setup and launch dev server
- `pnpm policy:check` — Architectural boundary enforcement
- `pnpm audit:compliance` — Run all audit gates
- `pnpm context:pack` — Create workspace bundle for analysis
- `make help` — List all commands
- `make verify` — Same as: pnpm --dir Arch-System agent:verify
- `make pipeline` — Full quality → preflight → local smoke → vercel preview → prod → audit

## Critical Conventions & Boundaries (NON-NEGOTIABLE)

- **Package Manager**: pnpm exclusively (v9.15.9 pinned in Arch-System/)
- **Light Mode Only**: Strict light mode (#f3f4f6); semantic OKLCH tokens from `@repo/theme`; no `dark:` variants
- **Architectural Boundaries** (enforced by policy compiler):
  - `apps/*` MUST NOT import `packages/database` directly — route via `@repo/supabase`
  - `packages/ui` must remain pure presentational (zero business logic)
  - No imports from `apps/*` into `packages/*` or `tools/*`
  - All primary data fetching in RSC / Server Actions / Handlers — never in `'use client'`
- **Server Actions**: Authenticate → authorize → validate via `@repo/contract` → rate-limit → invalidate cache → `redirect()`
- **Caching**: Next.js 16 cache components require named `cacheLife()` profile; mutations must invalidate tags
- **Client State**: `@tanstack/react-query` SSoT; SWR is prohibited
- **Commits**: Conventional commits via Husky/Commitlint; one commit per task
- **Secrets**: Never print, edit, or commit `.env*` secrets
- **Type Safety**: Strict TypeScript throughout; never use `any` or `@ts-ignore`
- **Never install packages at root**: Root is zero-dependency delegation runner only
- **Never move/rename service directories**: Hardcoded in federation watchdog configs

## Mandatory Verification Protocol (6-Pillar)

Before declaring any task complete:

1. **Zero-Exception Verification**: Run `pnpm agent:verify` and self-heal any failures
2. **Dynamic Context Leasing**: Lease skills via `skills-mcp` (`acquire_skill`/`return_skill`)
3. **Structured Thinking (STM-0)**: Follow 5-phase protocol (Comprehension→Evidence→Solution→Criticism→Execution)
4. **Scoped Progression**: Decompose large objectives into atomic tasks before multi-package mutations
5. **AST Exploration**: Use `codemap`/`code-index`/`ast-grep` instead of catting large files
6. **Continuous Auditing**: Run corresponding domain audits (e.g., `pnpm audit:routing` for route changes)

**Verification Order** (use cheapest gate that can catch the change):

```
pnpm type-check        # Turbo type-check --concurrency=2
pnpm lint              # Turbo lint (biome check)
pnpm policy:check      # Architectural boundary compiler
pnpm audit:drift       # Contract vs DB/API alignment
pnpm agent:verify      # Mandatory gate (fails fast on first failure)
```

`pnpm agent:verify` fails fast on:
`type-check` → `lint` → `policy:check` → `audit:drift` → skill-spector → `mcp:verify` → `token:budget-check`

For release-grade changes, run the full `pnpm quality` gate.

## Context-First Execution & Auto-Compaction Mandate

1. **Gather Context First (Pre-Action)**: After the user sends a message, FIRST gather all required context (research, prompting the user, or exploring the codebase — all approved). **DO NOT perform any action without the required context.** Once gathered, proceed with the task.
2. **Auto-Compact & Ready Context (Post-Output)**: After each output produced, release dynamically leased skills/context, prune transient bloat, and ready/compact the context window (`/compact` when needed) for the next task. See `.agents/rules/context-lifecycle-and-compaction.md`.

## Where to Find Detailed Documentation

Instead of reading large files, consult these focused references:

- `Arch-System/AGENTS.md` — 12 always-on invariants (each with enforcing `audit:*` gate)
- `Arch-System/docs/agents/{architecture,commands,invariants,patterns}.md` — Full reference
- `Arch-System/apps/portal/AGENTS.md` — Endpoints, auth, queue/job contract, latency budgets
- `.agents/rules/evidence-based-verification-and-security.md` — E0–E4 evidence tiers, anti-assumption mandate
- `.agents/rules/execution-guardrails.md` — Pre-completion audits, migration/RLS rules, policy boundaries
- `Arch-System/.agents/rules/anti-mock-facade-invariants.md` — No mock returns/hardcoded IDs/bypasses in production code
- `.agents/rules/structured-thinking-mandate.md` — STM-0 — read before multi-file mutations

Note: `.agents/rules/` and `Arch-System/.agents/rules/` are hand-copied duplicates that have diverged — diff counterparts before editing either.

## Database Note

Migrations are `NNN_description.sql` in `Arch-System/packages/database/migrations/` (`packages/supabase/migrations` is a symlink). RLS is enforced on every table with atomic RPCs. Agents adding tooling, contracts, ports, or dependencies to a service directory **must** update that directory's `AGENTS.md` in the same change.
