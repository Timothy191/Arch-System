# PROGRESSIVE_DISCLOSURE.md — Context Index

> Load **only** the slice for the current task. Do not read the full repo.

## Always (≤4 files)

| File | When |
|------|------|
| `PROGRESSIVE_DISCLOSURE.md` | Every task (this file) |
| `MEMORY.md` | Persistent arch facts (before re-discovering) |
| `WHY.md` | Domain/business questions |
| `HOW.md` | Active spec + TodoWrite checklist |

## Slice: monorepo / portal (default)

| Need | Read |
|------|------|
| CI, RLS, commands | `AGENTS.md` |
| Design tokens, glass UI | `docs/PRODUCT.md` § Strategy (not full `DESIGN.md`) |
| Portal app structure | `rg` → `apps/portal/app/**` matched paths only |
| Shared UI | `packages/ui/src` matched component only |
| DB schema | `rg` → `packages/database/migrations/` |

## Slice: new `10-src/` module

| Need | Read |
|------|------|
| Module spec | `HOW.md` active task section |
| Prior learnings | `rg "<topic>" run/agent-learnings.jsonl` |
| Adjacent code | `rg` / `ast-grep` in `10-src/<prefix>/` |

## Slice: git / PR

| Need | Read |
|------|------|
| Pipeline | `.cursor/rules/git-github-pipeline.mdc` |
| Decisions | `HOW.md` architectural decisions log |

## Slice: frontend vs backend separation

| Need | Read |
|------|------|
| Active spec | `HOW.md` Phase A–D |
| Client trees | `rg '"use client"' apps/portal libs/features` |
| Server entrypoints | `rg 'createServerSupabaseClient|server-only' apps/portal libs packages` |
| Feature layout | `libs/features/*/ui` vs `libs/features/*/data-access` |

## Slice: agent orchestrator

| Need | Read |
|------|------|
| Frontier patterns | `.cursor/rules/frontier-agentic-patterns.mdc` |
| Effort tier | `python3 scripts/agent-orchestrator/classify-effort.py "<task>"` |
| High-tier workflow | `scripts/agent-orchestrator/dynamic-workflow.md` |
| Pre-ship verify | `bash scripts/agent-orchestrator/verify-gate.sh` |
| Post-compact recovery | `.ai_content/.memory/.cursor-memory/config/compaction-recovery.md` |

## Active context (update per task)

```
task: separate frontend (UI) from background logic (API, data-access, infra)
phase: A complete — violations V1–V8 in HOW.md; next Phase B dedupe
loaded: [HOW.md, active-context.md, MEMORY.md]
skip: docs/wiki/**, AGENT_TRACER.md
```

## Past learnings

Query: `rg -i "<keyword>" run/agent-learnings.jsonl | tail -10`
