# Root Workspace Agent Tracer

## 2026-06-25: Optimize HourlyLoadsGrid Performance and Correctness

### Purpose

Optimize `HourlyLoadsGrid.tsx` rendering performance, prevent cascading re-renders of the DataGrid, and resolve the shift key map collision issue where day/night shift records for the same machine would overwrite each other.

### Changes Made

1. **`HourlyLoadsGrid.tsx`** — Memoized `loadsByMachine` Map using `useMemo` with `[hourlyLoads]` dependency to stabilize dependent hook references.
2. **Shift Collision Resolution** — Adopted a composite key of `machine_id:shift_type` (e.g. `m1:day`) for `loadsByMachine` lookups to keep day and night shift records completely independent.
3. **O(1) Lookup Optimization** — Replaced O(N) array scans (`hourlyLoads.find(...)`) inside interaction event handlers (`handleCellChange`, `handleMaterialToggle`) and direct grid edit callback (`handleAfterEdit`) with O(1) composite map lookups.
4. **Performance Journal** — Logged critical findings and learnings regarding heavy data grid memoization and composite keys in `.jules/bolt.md`.

### What the Next Agent Should Know

- Any heavy state or computed lookups in grid render pathways should remain memoized to avoid triggering re-renders of the RevoGrid component.
- The shift collision regression test is located at `apps/portal/app/(departments)/[department]/hourly-loads/hourly-loads-keys.test.ts`.

---

## 2026-06-25: Wire portal to departments, hub, and shared libs (phase 2)

### Purpose

Cut portal department/hub routes over to `@repo/departments/ui`, `@repo/hub/ui`, and shared server actions via thin feature barrels.

### Changes Made

1. **Portal barrels** — `apps/portal/features/{departments,hub,dashboard}/index.ts` re-export libs.
2. **Routes** — Department and hub pages import from `@/features/departments` and `@/features/hub`.
3. **`@repo/shared/data-access`** — `revalidateRSC` server action for lib consumers.
4. **`packages/ui`** — `PrecisionInput` moved for `MachineControl` in departments lib.
5. **`.gitignore`** — ignore `.cursor/` and `knowledge.md`.

### What the Next Agent Should Know

- Departments lib still uses portal `@/lib` and `@/components` path aliases in tsconfig for shift-closeout and monitoring map layers.
- Do not duplicate `apps/portal/components/monitoring` into `packages/ui` without adding map deps to `@repo/ui`.

---

## 2026-06-25: Complete libs/ feature library migration (phase 1)

### Purpose

Finish Nx `libs/features` + `libs/shared` scaffold: workspace packages, path aliases, portal wiring for auth and shared modules.

### Changes Made

1. **`libs/`** — 13 workspace packages with `package.json`, `project.json` (`scope:feature`), and fixed `@repo/*` imports.
2. **`libs/shared/hooks`** — `useThrottledState`, `trackClientMetric` extracted from portal.
3. **`pnpm-workspace.yaml`** — `libs/features/*/*`, `libs/shared/*` globs.
4. **`tsconfig.base.json`** + **`apps/portal/tsconfig.json`** — path aliases for wired libs.
5. **Portal re-exports** — `lib/env`, `cache-utils`, `audit`, `weather-api`; auth `LoginForm`/`RefractionGlow` → `@repo/auth/ui`.
6. **`tools/apply-project-tags.cjs`** — tags libs projects automatically.
7. **`nx.json`** — `scope:feature` dependency constraints; preserved `defaultBase` and `analytics`.

### What the Next Agent Should Know

- Departments/hub/dashboard UI in `libs/` are scaffolded but portal still uses `apps/portal/features/*` copies — migrate via thin re-exports when ready.
- Run `pnpm install` after adding lib `package.json` deps.
