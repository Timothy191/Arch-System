# Active context (post-compact)

> **Agents:** Treat this file as the only conversation history. Search `.ai_content/.memory/.cursor-memory/sessions/` for depth.

## Blockers

- **GitHub sync:** `git fetch origin` / `git push` fail without credentials.

## Current objective

**Root numbered hierarchy** — completed on `feat/00-numbered-repo-hierarchy` (ADR-003). Resume **frontend/backend Phase B** when ready.

## Locked decisions

- Root layout: `00_applications` … `16_database_reference_artifacts` (usage-ranked)
- Greenfield source: `05_greenfield_application_source/NN_Module` only (not bare `10-src/`)
- `@repo/shared/*` packages live in `02_domain_libraries/shared/`; static assets in `04_shared_static_assets/`
- Agent memory: `.ai_content/.memory/.cursor-memory/`

## In-flight work

- Hierarchy migration: legacy dirs removed; `verify-root-hierarchy.py` passes
- Uncommitted changes on `feat/00-numbered-repo-hierarchy`

## Next action

1. Commit hierarchy completion; push when GitHub auth available
2. `pnpm install` refresh if lockfile drift
3. Phase B: dedupe dashboard-service (HOW.md V2)

## Memory pointer

`.ai_content/.memory/.cursor-memory/sessions/2026-06-30-root-numbered-hierarchy.md`

## Sync

| Field | Value |
|-------|-------|
| sync_status | blocked |
| branch | feat/00-numbered-repo-hierarchy |
| verify | `verify-root-hierarchy.py` OK |
