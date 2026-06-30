# Active context (post-compact)

> **Agents:** Treat this file as the only conversation history. Search `.ai_content/.memory/.cursor-memory/sessions/` for depth.

## Blockers

- **GitHub sync:** `git fetch origin` / `git push` fail without credentials. Commits local on `feat/separate-frontend-backend`.

## Current objective

**Frontend/backend separation** — Phase A audit **complete** (HOW.md). Next: Phase B extract & enforce (start with V2/V3 dedup: dashboard + breakdown actions).

## Locked decisions

- Agent memory root: `.ai_content/.memory/.cursor-memory/` (`scripts/memory/memory_paths.py`)
- Login glass + production layout: ADR-001, ADR-002; UI in `10-src/00_core_modules/`
- Layer stack: UI → API/actions → data-access → infra
- `NN_` renumber deferred until after split

## In-flight work

- Branch: `feat/separate-frontend-backend`
- Unpushed commit pending (wrap-up this turn)

## Next action

1. Phase B: dedupe `dashboard-service` → `libs/features/dashboard/data-access` only
2. Move `breakdowns/actions` + `SafetyDashboard` fetch to `data-access`
3. Configure GitHub auth; push branch

## Memory pointer

`.ai_content/.memory/.cursor-memory/sessions/2026-06-30-frontend-backend-phase-a.md`

## Sync (last `/summarize` wrap-up)

| Field | Value |
|-------|-------|
| sync_status | blocked |
| branch | feat/separate-frontend-backend |
| commit | (this turn) |
| blockers | GitHub fetch/push auth |
| verify | portal login tests 10/10 |
