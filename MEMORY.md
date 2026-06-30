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
| `.memory/` | Session summaries + compaction; `/summarize` = wrap-up (ship/sync) then archive |
| `.memory/.recall-brief.md` | Auto-recall brief — hooks refresh each session/prompt (`scripts/memory/auto-recall.py`) |
| `.memory/.turn-session.json` | Per-turn session (tier, git delta, verify) — `turn-session-begin.sh` hook + `turn-close-status.py` |
| `scripts/agent-orchestrator/turn_session_lib.py` | Session-scoped intelligence gain (no global HOW open-item penalty) |
| `run/agent-learnings.jsonl` | Ephemeral lessons; promote stable ones here |
| `.cursor/hooks.json` | Turn counter + `preCompact` → auto-compact flags |
| `.cursor/rules/*.mdc` | Always-on orchestrator directives |
| `scripts/lending-library/` | Adaptive lending library — `catalog.json`, checkout/return, ephemeral fetch to `run/lending-library/` |
| `.cursor/rules/adaptive-agentic-mode.mdc` | Fetch-use-return orchestrator; lean context by default |
| `.cursor/rules/frontier-agentic-patterns.mdc` | Cloned patterns from Fable 5, Opus 4.8, GPT-5.5, Grok, Gemini |
| `scripts/agent-orchestrator/` | Effort classify, verify gate, dynamic workflow template |
| `scripts/memory/auto-recall.py` | Auto-recall brief → `.memory/.recall-brief.md` (hooks + manual) |

## Search policy

- **Search, don't index** — `rg`, `ast-grep`, `Grep`, `Glob` only. No RAG, no vector DBs, no DAG scaffolding.
- Before similar work: `rg -i "<topic>" .memory/sessions/ .memory/index.jsonl MEMORY.md`
- Verify paths with `ls`/`tree` before writes. Never use bare `src/`.

## Offline-first principle

All new data paths (Next.js, FastAPI, Supabase) must support local sync and eventual consistency for disconnected mine sites.

## Session log

| Date | Fact learned | Promoted from |
|------|--------------|---------------|
| 2026-06-29 | Frontier scaffolding: Fable 5 = long-horizon + self-verify; Opus 4.8 = parallel subagents + adaptive effort; GPT-5.5 = terminal + parallel tools; Grok 4.20 = debate/consensus; harness clones via `scripts/agent-orchestrator/` + `frontier-agentic-patterns.mdc` | agentic research |
| 2026-06-29 | Fable 5 / Mythos 5 suspended globally June 2026; Opus 4.8 is practical Claude fallback for agentic coding | public status |
| 2026-06-30 | Frontend/backend split: UI → API/actions → data-access → infra; deferred `NN_` renumber | /summarize |
| 2026-06-29 | Production realism: no foo/bar/Lorem; mining domain terms; halt if schema unknown | mission §3 |
