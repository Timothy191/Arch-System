# MEMORY.md — Persistent Architectural Memory

> Survives context resets. Append stable facts only — not task checklists (those live in `HOW.md`).

## Workspace topology (verified)

| Path | Purpose |
|------|---------|
| `apps/portal` | Next.js 15+ App Router — primary operations UI |
| `apps/cms` | Payload CMS v3 |
| `apps/overview` | React Flow architecture viz |
| `packages/*` | `@repo/theme`, `@repo/ui`, `@repo/supabase`, `@repo/database`, etc. |
| `10-src/` | **Not present** — mission greenfield root; use when created |
| `e2e/` | Playwright; auth state in `e2e/.auth/user.json` |
| `tools/` | Policy compiler, RLS audit, design audit |
| `run/` | Runtime logs, local agent learnings (gitignored) |

## Non-negotiable conventions

- **Auth source of truth:** `employees` table — not Supabase Auth metadata.
- **RLS:** Every new table; `pnpm audit:rls` + `policy:check` in CI.
- **Migrations:** Zero-padded SQL in `packages/database/migrations/`; commit with `database.types.ts`.
- **Design:** Light-only macOS glass; OKLCH via `@repo/theme`; `cn()` from `@repo/ui`; no dark mode.
- **Production realism:** No demo/placeholder data — mining domain terms only; halt for unknown schemas.
- **Default branch:** `master` (not `main`).
- **Quality gate order:** lint → type-check → test → build (`pnpm quality`).

## Harness stack (agent)

| Artifact | Role |
|----------|------|
| `WHY.md` | Domain authority |
| `HOW.md` | Active spec + **TodoWrite checklist** (plan before code) |
| `PROGRESSIVE_DISCLOSURE.md` | Context slice index |
| `MEMORY.md` | This file — persistent arch facts |
| `run/agent-learnings.jsonl` | Ephemeral lessons; promote stable ones here |
| `.cursor/rules/*.mdc` | Always-on orchestrator directives |
| `scripts/lending-library/` | checkout-skill / return-skill / record-learning |

## Search policy

- **Search, don't index** — `rg`, `ast-grep`, `Grep`, `Glob` only. No RAG, no vector DBs, no DAG scaffolding.
- Verify paths with `ls`/`tree` before writes. Never use bare `src/`.

## Offline-first principle

All new data paths (Next.js, FastAPI, Supabase) must support local sync and eventual consistency for disconnected mine sites.

## Session log

| Date | Fact learned | Promoted from |
|------|--------------|---------------|
| 2026-06-29 | Harness v2: `while(tool_call)` loop; TodoWrite plan in `HOW.md`; `MEMORY.md` for reset survival | mission bootstrap |
| 2026-06-29 | Production realism: no foo/bar/Lorem; mining domain terms; halt if schema unknown | mission §3 |
