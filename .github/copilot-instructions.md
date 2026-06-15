# Copilot instructions for Arch-Mk2

This file provides concise, repository-specific guidance for Copilot-style assistants and automated agents working in this monorepo. It points to authoritative docs when deeper rules apply.

---

## 1) Build, test and lint commands

- Install deps: `pnpm install`
- Dev (portal only): `pnpm dev` or `pnpm --filter portal dev`
- Start local Supabase (separate terminal / Docker): `pnpm --filter @repo/database supabase:dev`
- Build all: `pnpm build`
- Lint: `pnpm lint`
- Type-check: `pnpm type-check`
- Run unit tests (all): `pnpm test`
- Run a single portal test file: `pnpm --filter portal test -- --testPathPatterns=<file>`
- E2E (Playwright): `pnpm test:e2e` (requires dev server on :3000 and Chromium)
- Full quality gate: `pnpm quality` (lint → type-check → test → other checks)
- Format: `pnpm format` / check: `pnpm format:check`
- Useful: `pnpm --filter @repo/database supabase:gen` (regenerate DB types after migrations)

When making changes, run `pnpm quality` before proposing a merge.

---

## 2) High-level architecture (big picture)

- Monorepo managed with pnpm workspaces + Turborepo. Top-level layout:
  - apps/portal — Next.js 15+ (App Router) main app (React 19). Server Actions and APIs co-located.
  - apps/cms — Payload CMS v3 for content
  - apps/overview — visualization app
  - packages/\* — shared code (theme, ui, supabase, database, utils, redis, eval)

- Database: Supabase/Postgres. Source-of-truth migrations live in `packages/database/migrations/` (zero-padded NNN_name.sql). Never edit the deploy-time copy under `packages/supabase/supabase/migrations/`.

- Codegen pipelines:
  - Design tokens: `packages/theme/tokens.json` → `pnpm --filter @repo/theme codegen` → generated tokens used by Tailwind and CSS variables.
  - DB types: create SQL migration → `supabase:push` → `pnpm --filter @repo/database supabase:gen` → commit updated `packages/supabase/src/database.types.ts`.

- Build orchestration: tasks use `nx run-many` (not `turbo run`) and `turbo.json`/`nx.json` control pipeline behavior.

- Runtime conventions:
  - Middleware: `apps/portal/proxy.ts` handles session refresh, department slug → UUID resolution (Redis cached), and route gating.
  - Authorization: `employees` table is the source of truth for roles/department. RLS must be enabled on new tables.

- CI order: `deps:lint → lint → type-check → test → build → bundlesize`.

Refer to `CLAUDE.md` and `AGENTS.md` for detailed, authoritative rules and agent contracts.

---

## 3) Key repository conventions (do not invent these)

- Package versioning: workspace-wide catalogs live in `pnpm-workspace.yaml`. Use the catalog entries (e.g., `catalog:react19`) when updating shared deps.

- Migrations:
  - File names: `NNN_description.sql` (zero-padded sequence).
  - Workflow: add migration → `pnpm --filter @repo/database supabase:push` → `pnpm --filter @repo/database supabase:gen` → commit both migration and regenerated types.
  - Do not edit `packages/supabase/supabase/migrations/` directly.

- Tests:
  - Jest portal config requires explicit `moduleNameMapper` entries for new `@repo/*` imports in `apps/portal/jest.config.js`. Add mappings when making new package exports or subpath imports.
  - Unit tests do not require Supabase running; E2E does.

- Portal routing & layout:
  - App Router groups: `(auth)/`, `(departments)/[department]/`, `(hub)/`, `admin/`.
  - Static department sub-pages must export their own `layout.tsx` which re-exports `DepartmentLayout`.
  - Path aliases: `~/* → apps/portal/*` and `@/* → apps/portal/*`.

- Design system and component rules (enforced):
  - Light-only theme (no dark mode) — `data-theme="light"`.
  - Use design tokens from `@repo/theme` (Style Dictionary) — do not hardcode colors.
  - Forbidden: raw `box-shadow` / Tailwind `shadow-*` classes. Use provided shadow tokens (e.g., `shadow-card`).
  - Always use `cn()` from `@repo/ui/lib/utils` to merge classes.
  - Icon imports must be named imports (e.g., `import { Drill } from 'lucide-react'`), not `* as Icons`.
  - Animation: limit to `opacity`, `transform`, `background-color`, `border-color`, `color` (no layout props).

- Code generation & CI checks:
  - After editing design tokens, commit both `tokens.json` and the generated `packages/theme/src/tokens/generated.ts`.
  - Use `pnpm knip:fix` for unused exports remediation; add new entries to `knip.json` when appropriate.

- Agent & bot behavior expectations:
  - Respect injected reporecall/CLAUDE context: prefer the injected context first and avoid re-fetching files that are included in that injection.
  - `.claude/settings.json` hooks run Prettier on edits and ESLint asynchronously on portal source files — generated edits must obey formatting/lint rules.
  - Pause for human review at: plan completion, >5 file edits, any git operations that touch auth or DB schema.

- Git & commit rules:
  - Husky hooks enforce lint-staged & pre-push quality checks. Do not bypass with `--no-verify`.
  - Repository requires conventional commits; CI expects `commit-msg` checks.

---

## 4) Other AI assistant configs to consult (authoritative sources)

- CLAUDE.md — repository-specific agent rules and runtime requirements
- AGENTS.md — agent contracts, pipelines, and codegen workflows
- .claude/\* — additional operational rules and hooks

When an assistant needs deeper policy or phase rules, consult those files before taking risky or wide-reaching actions.

---

## 5) Quick heuristics for automated changes

- Small, targeted edits (≤5 files) can be done directly. Larger cross-cutting changes should be planned and run through `pnpm quality` afterwards.
- For DB migrations and auth changes: stop and request explicit human confirmation (these affect live data and security).
- If a new `@repo/*` import is added to portal code, update `apps/portal/jest.config.js` `moduleNameMapper`.

---

## 6) Where to attach follow-up notes

- If the assistant needs to persist a decision or rule, wait for human approval.

---

(Prepared from README.md, CLAUDE.md, AGENTS.md and root workspace config.)
