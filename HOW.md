# HOW.md — Implementation Specification

> Update before production code. Link decisions here from PRs and learnings.

## Active task

| Field | Value |
|-------|-------|
| **Task** | _(unset — awaiting first objective)_ |
| **Branch** | _(unset)_ |
| **Status** | `spec-pending` |

## TodoWrite checklist (Phase 2 — complete before production code)

> Sequential plan. Mark `[x]` as executed. Do not write production code until this section is filled.

- [ ] _(awaiting first objective)_

## Interfaces & data models

_(define when task is set)_

## Implementation standards

- Source routing: `10-src/` for new mission modules; existing `apps/` / `packages/` per `AGENTS.md` until migration.
- Numbered prefixes under `10-src/`: `01_Admin`, `02_Fleet`, etc.
- RLS on every new table; migration + `database.types.ts` atomically.
- UI: `@repo/theme` OKLCH tokens, `cn()`, named lucide imports.

## Verification checklist

- [ ] Lint + type-check scoped to touched packages
- [ ] Tests for behavior changes
- [ ] `pnpm audit:rls` if schema touched
- [ ] `PROGRESSIVE_DISCLOSURE.md` slice updated

## Architectural decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| — | — | — |
