# HOW.md — Implementation Specification

> Update before production code. Link decisions here from PRs and learnings.

## Active task

| Field | Value |
|-------|-------|
| **Task** | Separate frontend (UI) from background logic (server, data, jobs) |
| **Branch** | `feat/separate-frontend-backend` (create before first commit) |
| **Status** | `spec-ready` |

## TodoWrite checklist (Phase 2 — complete before production code)

> Sequential plan. Mark `[x]` as executed. Do not write production code until this section is filled.

### Phase A — Boundary map (read-only audit)

- [ ] Inventory `apps/portal`: list `app/api/**`, Server Actions, `createServerSupabaseClient` call sites, client `"use client"` modules
- [ ] Inventory `libs/features/**` and `packages/*`: classify UI-only vs data-access vs server-only
- [ ] Document current violations: business logic inside client components, direct DB in route handlers without service layer
- [ ] Define target layers (names only, no biological metaphors):

| Layer | Location | Allowed imports |
|-------|----------|-----------------|
| **UI (frontend)** | `apps/portal/components`, `libs/features/*/ui`, `@repo/ui` | types, hooks that call APIs; no `server-only` |
| **Application API** | `apps/portal/app/api/**`, Server Actions in `libs/features/*/actions` | services, auth guards |
| **Domain / services** | `libs/features/*/data-access`, `packages/*` (no React) | Supabase client, redis, pure functions |
| **Infrastructure** | `packages/database`, `packages/redis`, `packages/supabase`, `redis/`, `infra/` | external I/O only |

### Phase B — Extract & enforce

- [ ] Move server-only code behind `import "server-only"` barrels where missing
- [ ] Pull Supabase/redis/business rules out of client components into `data-access` or `app/api`
- [ ] Client hooks (`useLogin`, metrics, weather) call API routes or Server Actions only — no env secrets in bundle
- [ ] Add ESLint boundary rule or `nx` module boundaries tag (`scope:frontend` vs `scope:backend`) if already supported
- [ ] Login/auth path: `LoginForm` (UI) → `useLogin` → server action/API → `@repo/supabase` (already partial — finish split)

### Phase C — Background / async (non-UI)

- [ ] Classify scripts (`scripts/dev.sh`, redis, memory hooks) as ops — not imported by portal UI
- [ ] Health checks, rate-limit, RLS audit stay server-side; portal consumes JSON only
- [ ] Document in `AGENTS.md`: frontend never imports from `scripts/`, `infra/`, `redis/` directly

### Phase D — Verify & ship

- [ ] `pnpm --filter portal lint && type-check`
- [ ] `pnpm quality` if boundaries touch multiple packages
- [ ] Update `PROGRESSIVE_DISCLOSURE.md` slice `frontend vs backend`

### Deferred (prior objective)

- [ ] Repo `NN_` directory renumber by usage — after frontend/backend split or parallel branch

## Interfaces & data models

- **Frontend contract:** typed fetch to `/api/*` + Server Action return shapes (Zod at boundary)
- **No raw Supabase service role in client bundle**
- Offline-first: UI queues writes; background sync via existing patterns (unchanged principle)

## Implementation standards

- UI: `@repo/theme` tokens, `cn()`, light glass/brushed brand — no server imports
- Server: `createServerSupabaseClient()` + employee auth line one; RLS enforced
- `10-src/` greenfield modules follow same UI vs `data-access` split when migrated

## Verification checklist

- [ ] No `server-only` package imported from `"use client"` files (grep + build)
- [ ] Portal build does not embed `SUPABASE_SERVICE_KEY`, redis URLs beyond public config
- [ ] Lint + type-check scoped packages

## Architectural decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-29 | Frontend/backend separation is next priority over `NN_` renumber | User directive — clarify boundaries before large tree moves |
| 2026-06-29 | Layers: UI → API/actions → data-access → infrastructure | Matches existing `libs/features` shape; minimal new folders |
| 2026-06-29 | Login card: top-aligned, symmetric `py-6` margins, reduced `pt-5` | UI polish this session |
