# MEMORY.md — Persistent Architectural Memory

> Survives context resets. Append stable facts only — not task checklists (those live in `HOW.md`).

## Workspace topology (verified)

Root directories use `NN_descriptive_snake_case` ranked by usage (ADR-003). Lowest prefix = highest traffic.

| Prefix | Path | Purpose |
|--------|------|---------|
| 00 | `apps/` | Deployable apps: portal, cms, overview |
| 01 | `pkgs/` | `@repo/*` platform libs (ui, theme, database, supabase, …) |
| 02 | `libs/` | Feature UI + data-access (`features/*`, `shared/*`) |
| 03 | `ops/` | Dev, deploy, agent orchestration, lending-library |
| 04 | `assets/` | Icons/images synced to portal `public/` |
| 05 | `src/` | Mission-scoped greenfield (`00_core_modules`, `01_Admin`, …) |
| 06 | `docs/` | ADRs, wiki, product docs |
| 07 | `toolchain/` | Lint/policy/toolchain config |
| 08 | `tools/` | Policy compiler, RLS audit, design audit |
| 09 | `e2e/` | Playwright; auth state in `.auth/user.json` |
| 10 | `infra/` | Docker, K8s, compose |
| 12 | `cache/` | Local Redis offload stack |
| — | `run/` | Runtime logs, agent learnings (gitignored) |

## Non-negotiable conventions

- **Auth source of truth:** `employees` table — not Supabase Auth metadata.
- **RLS:** Every new table; `pnpm audit:rls` + `policy:check` in CI.
- **Migrations:** Zero-padded SQL in `pkgs/database/migrations/`; commit with `database.types.ts`.
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
| `.ai_content/.memory/.cursor-memory/` | Session summaries + compaction; `/summarize` = wrap-up then archive |
| `.ai_content/.memory/.cursor-memory/.recall-brief.md` | Auto-recall brief — hooks refresh each session/prompt |
| `.ai_content/.memory/.cursor-memory/.turn-session.json` | Per-turn session (tier, git delta, verify) |
| `.ai_content/.cursor/rules/` | Always-on orchestrator directives (moved from repo `.cursor/rules/`) |
| `ops/lending-library/` | Adaptive lending library — `catalog.json`, checkout/return, ephemeral fetch to `run/lending-library/` |
| `.cursor/rules/adaptive-agentic-mode.mdc` | Fetch-use-return orchestrator; lean context by default |
| `.cursor/rules/frontier-agentic-patterns.mdc` | Cloned patterns from Fable 5, Opus 4.8, GPT-5.5, Grok, Gemini |
| `ops/agent-orchestrator/` | Effort classify, verify gate, dynamic workflow template |
| `ops/memory/auto-recall.py` | Auto-recall brief → `.ai_content/.memory/.cursor-memory/.recall-brief.md` |
| `ops/memory/memory_paths.py` | Canonical cursor memory root resolver |

## Search policy

- **Search, don't index** — `rg`, `ast-grep`, `Grep`, `Glob` only. No RAG, no vector DBs, no DAG scaffolding.
- Before similar work: `rg -i "<topic>" .ai_content/.memory/.cursor-memory/sessions/ MEMORY.md HOW.md`
- Verify paths with `ls`/`tree` before writes. Never use bare `src/`.

## Offline-first principle

All new data paths (Next.js, FastAPI, Supabase) must support local sync and eventual consistency for disconnected mine sites.

## Session log

| Date | Fact learned | Promoted from |
|------|--------------|---------------|
| 2026-06-29 | Frontier scaffolding: Fable 5 = long-horizon + self-verify; Opus 4.8 = parallel subagents + adaptive effort; GPT-5.5 = terminal + parallel tools; Grok 4.20 = debate/consensus; harness clones via `scripts/agent-orchestrator/` + `frontier-agentic-patterns.mdc` | agentic research |
| 2026-06-29 | Fable 5 / Mythos 5 suspended globally June 2026; Opus 4.8 is practical Claude fallback for agentic coding | public status |
| 2026-06-30 | Agent memory root moved to `.ai_content/.memory/.cursor-memory/`; hooks/scripts use `memory_paths.py` | user migration |
| 2026-06-30 | Frontend/backend split: UI → API/actions → data-access → infra; deferred `NN_` renumber | /summarize |
| 2026-06-29 | Production realism: no foo/bar/Lorem; mining domain terms; halt if schema unknown | mission §3 |
| 2026-06-30 | Recovering permanently deleted untracked files using git fsck --lost-found to retrieve dangling blobs when a git clean -fd collision occurs | git-recovery |
