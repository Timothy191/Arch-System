# Active context (post-compact)

> **Agents:** Treat this file as the only conversation history. Search `.memory/sessions/` for depth.

## Current objective

**Separate frontend (UI) from background logic** — server APIs, data-access, infra, and scripts must not leak into client bundles. Audit `apps/portal` + `libs/features/*`, enforce UI → API/actions → services → infra layers.

## Locked decisions

- Layer stack: UI (`components`, `*/ui`) → `app/api` + Server Actions → `data-access` / `packages/*` → `infra`, `redis/`, `scripts/`
- Client hooks call APIs only; no `server-only` in `"use client"` trees
- `NN_` directory renumber **deferred** until after this split (or parallel branch)
- Login UI: symmetric `py-6` outer margins, `pt-5` card top, brushed taskbar matches login brand

## In-flight work

- Large local diff on `master` (harness, redis, UI) — **staged, not committed** (git identity + GitHub auth blockers)
- Frontend/backend split: spec in `HOW.md` only — **not started**

## Next action

1. `git checkout -b feat/separate-frontend-backend`
2. Run Phase A audit: `rg "use client" apps/portal` + `rg "createServerSupabaseClient|server-only" apps/portal libs`
3. List violations in `HOW.md` checklist before moving code

## Memory pointer

`.memory/sessions/2026-06-30-frontend-backend-split.md`

## Sync (last `/summarize` wrap-up)

| Field | Value |
|-------|-------|
| sync_status | blocked |
| branch | master |
| commit | staged, not committed |
| blockers | git user.email/name unset; GitHub fetch/push unavailable; unstage `__pycache__` before commit |
