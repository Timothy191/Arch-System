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

## Active context (update per task)

```
task: none
loaded: [MEMORY.md]
skip: docs/wiki/**, AGENT_TRACER.md, docs/DESIGN.md (unless UI token work)
```

## Past learnings

Query: `rg -i "<keyword>" run/agent-learnings.jsonl | tail -10`
