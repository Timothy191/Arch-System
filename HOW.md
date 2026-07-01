# HOW.md — Implementation Specification

> Update before production code. Link decisions here from PRs and learnings.

## Active task

| Field | Value |
|-------|-------|
| **Task** | Update omp CLI tool |
| **Branch** | `feat/self-improvement-protocol` |
| **Status** | `in-progress` |

## TodoWrite checklist (Phase 2 — complete before production code)

> Sequential plan. Mark `[x]` as executed. Do not write production code until this section is filled.

### Implementation checklist

- [x] Execute `omp update` to pull latest updates for the agent CLI
- [x] Verify updated `omp` version and run a basic health/help check

### Previous task (deferred)


- [x] Inventory `apps/portal`: list `app/api/**`, Server Actions, `createServerSupabaseClient` call sites, client `"use client"` modules
- [x] Inventory `libs/features/**` and `packages/*`: classify UI-only vs data-access vs server-only
- [x] Document current violations: business logic inside client components, direct DB in route handlers without service layer
- [x] Define target layers (names only, no biological metaphors):

#### Phase A inventory (2026-06-30)

**`apps/portal` counts**

| Signal | Count | Notes |
|--------|------:|-------|
| `"use client"` modules | 127 | No direct `@repo/supabase/server` / `server-only` imports in client files (grep clean) |
| `app/api/**/route.ts` | 36 | See route list below |
| `createServerSupabaseClient` call sites | 66 | Pages, API routes, `lib/*`, Server Actions |
| `"use server"` modules | 16 | Split across `app/`, `features/`, `lib/` |

**API routes** (`apps/portal/app/api/`): `admin/data/[table]`, `agent/chat`, `agent/config`, `auth/login`, `c66`, `control-room/shift-completeness`, `csp-violations`, `doc`, `export/*` (4), `feedback`, `health/*` (7), `inngest`, `log`, `metrics`, `metrics/prometheus`, `plugins/rust-telemetry`, `printers/*` (3), `search`, `sync/playback`, `telemetry/push`, `tools/status`, `weather`, `webhooks/*` (3).

**Server Actions locations** (should consolidate under `libs/features/*/actions` in Phase B):

- `apps/portal/app/actions.ts`
- `apps/portal/app/(departments)/*/actions.ts`, `printing.ts`, inline in `print-cards/page.tsx`
- `apps/portal/features/admin/actions/*`
- `apps/portal/features/departments/components/engineering/breakdowns/actions.ts` (duplicate of libs)
- `apps/portal/features/dashboard/services/dashboard-service.ts` (`"use server"`)
- `apps/portal/lib/shift-closeout.ts` (`"use server"`)

**`libs/features/**` classification**

| Package | Role today | Boundary fit |
|---------|------------|--------------|
| `auth/ui`, `auth/data-access` (`use-login`) | UI + hook → API | UI layer OK; hook calls `/api/auth/login` |
| `auth/utils` | redirect helpers | Shared util — OK |
| `dashboard/data-access` | `"use server"` + Supabase RPC | Correct layer; **duplicated** in portal |
| `departments/ui` | React components + **SafetyDashboard RSC fetch** + **breakdowns/actions** | Violations — server code in `ui` |
| `departments/data-access` | `departments.ts` only | Underused vs portal `lib/` |
| `hub/ui`, `access-control/ui`, `analytics/data-access` | Mostly UI / forecast | OK |

**`packages/*`**: `supabase/server`, `redis`, `database`, `errors`, `logger` — infrastructure only; no React. Correct.

**`src/00_core_modules`**: UI-only (login form, glass chrome) — aligned with target UI layer.

#### Violations (prioritized for Phase B)

| # | Violation | Paths | Severity |
|---|-----------|-------|----------|
| V1 | Server Actions + Supabase in `features/*/services` and scattered `app/` | `portal/features/dashboard/services`, `portal/app/actions.ts`, dept `actions.ts` | High |
| V2 | **Duplicate** dashboard service (portal vs libs) | `apps/portal/features/dashboard/services/` ↔ `libs/features/dashboard/data-access/` | High |
| V3 | **Duplicate** breakdown actions (portal vs libs) | `portal/features/departments/.../actions.ts` ↔ `libs/.../ui/.../actions.ts` | High |
| V4 | RSC data fetch inside `libs/features/*/ui` | `libs/features/departments/ui/src/safety/SafetyDashboard.tsx` | Medium |
| V5 | Server actions in `libs/features/*/ui` | `libs/.../breakdowns/actions.ts` | Medium |
| V6 | `apps/portal/lib/*` monolith (auth, redis, shift, dept-context, rate-limit) | 15+ files import `@repo/redis` or server Supabase | Medium |
| V7 | API routes inline DB/export logic without shared service | `export/*`, `admin/data/[table]`, `search` | Medium |
| V8 | Portal `features/` mirrors `libs/features/` (two trees) | `apps/portal/features/**` vs `libs/features/**` | Structural |

**Clean signals (keep):** zero client-bundle server imports; `use-login` → API only; `10-src` UI-only; infra packages isolated.


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

- [x] Repo `NN_` directory renumber by usage — ADR-003; `finish-root-hierarchy.py` + verify gate

## Interfaces & data models

- **Frontend contract:** typed fetch to `/api/*` + Server Action return shapes (Zod at boundary)
- **No raw Supabase service role in client bundle**
- Offline-first: UI queues writes; background sync via existing patterns (unchanged principle)

## Implementation standards

- UI: `@repo/theme` tokens, `cn()`, light glass/brushed brand — no server imports
- Server: `createServerSupabaseClient()` + employee auth line one; RLS enforced
- `src/` greenfield modules follow same UI vs `data-access` split when migrated

## Verification checklist

- [ ] No `server-only` package imported from `"use client"` files (grep + build)
- [ ] Portal build does not embed `SUPABASE_SERVICE_KEY`, redis URLs beyond public config
- [ ] Lint + type-check scoped packages

## Architectural decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-29 | Frontend/backend separation is next priority over `NN_` renumber | User directive — clarify boundaries before large tree moves |
| 2026-06-29 | Layers: UI → API/actions → data-access → infrastructure | Matches existing `libs/features` shape; minimal new folders |
| 2026-06-30 | Login glass branding system — ADR-001 | Brushed silver/gold card, service banner, CLI ticker, shine orchestrator; see `docs/adr/ADR-001-login-glass-branding-system.md` |
