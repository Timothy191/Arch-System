# CLAUDE.md

## Setup

export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$PATH"

# Verify: node -v → v24.15.0

## Commands

pnpm dev # Full dev system (0.0.0.0:3000)
pnpm dev:quick # Headless quick boot
pnpm dev:turbo # Portal dev via Turborepo
pnpm build # Full Turborepo build
pnpm type-check # Workspace TypeScript check
pnpm lint # Linting (Biome)
pnpm quality # Full quality gate
pnpm agent:verify # MANDATORY verification before completing any task
pnpm audit:browser # Closed-loop browser, devtools & a11y probe
pnpm test # All unit tests (Jest 30 SSoT)
pnpm --filter portal test # Portal unit tests
pnpm test -- <path/to/file.test.ts> # Specific test file
pnpm test:e2e # Playwright E2E (:3000)
pnpm test:a11y # Storybook accessibility tests
pnpm --filter @repo/database db:types # Regenerate Supabase types
pnpm db:seed # Seed dev database
pnpm --filter @repo/database supabase:start # Start local Supabase
pnpm --filter @repo/database supabase:reset # Reset local database
./setup.sh --dev # One-command setup and launch dev server
pnpm policy:check # Architectural boundary enforcement
pnpm audit:compliance # Run all audit gates
pnpm context:pack # Create workspace bundle for analysis
make help # List all commands
make verify # Same as: pnpm --dir Arch-System agent:verify
make pipeline # Full quality → preflight → local smoke → vercel preview → prod → audit

## High-Level Architecture

Turborepo monorepo using pnpm workspaces:

- **`apps/portal`** — Next.js 16 App Router (React 19) with Turbopack, main mining operations portal
- **`packages/`** — Shared infrastructure:
  - `@repo/contract` — Zod schemas (SSoT for data validation)
  - `@repo/supabase` — Supabase clients and Kysely query builders
  - `@repo/database` — SQL migrations and schema (SSoT)
  - `@repo/theme` — Design tokens, OKLCH color system, Tailwind config
  - `@repo/ui` — Pure presentational components (Radix UI/shadcn/ui)
  - `@repo/utils` — Third-party integrations (Novu, Inngest, Excel)
  - `@repo/agents` — Shared agent coordination engine
  - `@repo/redis` — Redis client and caching helpers
- **`libs/`** — Domain-specific features:
  - `libs/features/*` — Feature modules with UI and data-access layers
  - `libs/shared/*` — Cross-cutting utilities, hooks, and data-access

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

## Service-Specific Commands

Inside service directories:
**Portal (`Arch-System/apps/portal/`)**:

- `npm run start:dev` / `build` / `lint` / `test` / `test:e2e`
- Note: `pnpm test` here is `jest --passWithNoTests` (no actual tests)

**Apps/Portal (`Arch-System/apps/portal/`)**:

- `pnpm dev` / `build` / `lint` / `type-check` / `test`
- Note: Dev runs Webpack (not Turbopack); prod builds use Turbopack

## Cross-Service Contracts

Drift happens here — changes on one side without the other break `make status`:
| Producer (SSoT) | Consumer |
| :-------------- | :------- |
| `Arch-System/packages/contract/src` (Zod schemas) | `Arch-System/apps/portal/src` (DTOs, `src/queue/workflow-job.types.ts`) |

Workflow path: portal → `POST /workflows/dispatch` (bearer `DISPATCH_API_KEY`) → BullMQ queue `n8n-workflow-queue` → job `execute-workflow` → n8n. Dispatch returns 503 (not a fake 2xx) when Redis is down.

## Troubleshooting

- If `pnpm` hangs: kill it and use `make` targets (`make dev`, `make build`, `make test`) or direct `turbo`/`node`
- For local network access: server binds to `0.0.0.0:3000` accessible via `<YOUR_LOCAL_IP>:3000`
- Environment setup: `./setup.sh` handles dependency installation and `.env` configuration from templates
- If encountering "command not found" errors, verify your PATH is set correctly per the Session Setup section above
- Remember: `.env` for the portal is required before any portal build/dev; `Arch-System/setup.sh` will seed it from `apps/portal/env/.env.example` if missing

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
