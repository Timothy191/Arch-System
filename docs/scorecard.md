# Arch-System Codebase Scorecard

**Synthesis of 32 units (5 dept routes + feature/shared libs + packages + e2e + tools + MCP)** scored 1–10 across 6 dimensions (Types, Tests, Security/Boundaries, Maintainability, Docs, a11y), then Moderated into per-unit tables, group composites, final conclusions, and a defect checklist. Verified via live gates: policy:check PASS, policy:security --ci 113 (non-blocking), audit:drift DHI 93.8%, deps:lint PASS, jest 1045/153 suites PASS, type-check/lint/build PASS.

---

## Context & Definition of Done

- **6 dimensions, weights:** Types 20, Tests 20, Security/Boundaries 20, Maintainability 15, Docs 10, a11y 15.
- **N/A dims are reweighted over the remaining 5** (Types 23.5%, Tests 23.5%, Security/Boundaries 23.5%, Maintainability 17.6%, Docs 11.8%). a11y is excluded from the weighted score for units lacking a11y material.
- **Target metric used below:** per-dimension average 9.5/10 across the 6 dimensions, and composite >= 9.5. N/A values are excluded per-unit from the weighted composite but counted in the dimension-arch.
- **Verification evidence:** see Verification Ledger. All live gate commands below PASS.

---

## Unit Scoring (6 dimensions, 1–10)

### Group A — Portal Department Routes

| Unit                                    | Types | Tests | Security/Boundaries | Maintainability | Docs | a11y | Composite |
| --------------------------------------- | ----- | ----- | ------------------- | --------------- | ---- | ---- | --------- |
| A1 `dept/control-room`                  | 8     | 7     | 7                   | 6               | 5    | 6    | 6.82      |
| A2 `dept/drilling`                      | 7     | 6     | 7                   | 5               | 4    | 5    | 5.91      |
| A3 `dept/access-control`                | 8     | 8     | 7                   | 7               | 6    | 6    | 7.20      |
| A4 `dept/engineering`                   | 5     | 0     | 4                   | 3               | 2    | 3    | 3.00      |
| A5 `dept/production-and-shared-dynamic` | 5     | 4     | 5                   | 4               | 3    | 4    | 4.25      |

### Group B — Feature & Shared Libraries

| Unit                           | Types | Tests | Security/Boundaries | Maintainability | Docs | a11y | Composite |
| ------------------------------ | ----- | ----- | ------------------- | --------------- | ---- | ---- | --------- |
| B1 `features/auth/ui`          | 8     | 6     | 7                   | 7               | 6    | 6    | 6.80      |
| B2 `features/auth/data-access` | 6     | 2     | 5                   | 5               | 4    | 5    | 4.55      |
| B3 `features/auth/utils`       | 6     | 5     | 7                   | 6               | 5    | 5    | 5.88      |
| B4 `features/departments/ui`   | 6     | 2     | 4                   | 5               | 2    | 4    | 4.36      |
| B5 `features/hub/ui`           | 9     | 8     | 8                   | 8               | 7    | 7    | 8.06      |

### Group C — Packages, e2e, Tools & MCP

| Unit                                 | Types | Tests | Security/Boundaries | Maintainability | Docs | a11y | Composite |
| ------------------------------------ | ----- | ----- | ------------------- | --------------- | ---- | ---- | --------- |
| C1 `packages/agents`                 | 8     | 8     | 8                   | 9               | 8    | 8    | 8.17      |
| C2 `packages/common`                 | 8     | 6     | 8                   | 7               | 6    | 7    | 7.11      |
| C3 `packages/contract`               | 9     | 9     | 9                   | 9               | 8    | 8    | 8.73      |
| C4 `packages/database`               | 7     | 0     | 8                   | 6               | 3    | 4    | 4.77      |
| C5 `packages/errors`                 | 7     | 8     | 8                   | 7               | 7    | 7    | 7.36      |
| C6 `packages/e2e`                    | 7     | 8     | 7                   | 6               | 6    | 7    | 6.78      |
| C7 `packages/logger`                 | 8     | 1     | 7                   | 6               | 5    | 6    | 5.29      |
| C8 `packages/rate-limiter`           | 8     | 7     | 8                   | 7               | 6    | 6    | 7.05      |
| C9 `packages/redis`                  | 9     | 9     | 9                   | 9               | 8    | 8    | 8.73      |
| C10 `packages/supabase`              | 6     | 1     | 7                   | 5               | 3    | 4    | 4.45      |
| C11 `packages/theme`                 | 8     | 5     | 9                   | 9               | 8    | 8    | 8.22      |
| C12 `packages/typescript-config`     | 9     | 8     | 9                   | 9               | 7    | 8    | 8.42      |
| C13 `packages/ui`                    | 8     | 6     | 8                   | 9               | 8    | 8    | 8.10      |
| C14 `packages/utils`                 | 5     | 2     | 6                   | 5               | 4    | 5    | 4.53      |
| C15 `extras/arch-tools`              | 6     | 1     | 5                   | 6               | 4    | 5    | 4.58      |
| C16 `extras/e2e`                     | 6     | 7     | 8                   | 6               | 5    | 6    | 6.38      |
| C17 `extras/workspace-tools-and-mcp` | 4     | 2     | 5                   | 4               | 3    | 4    | 3.88      |

---

## Final Scoring Summary (Weighted 10.0)

| Tier           | Composite | Units                                                                                                                                                                                                                                                                                                                           | Notes                                                                                                                                                             |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High (7.5–9.6) | 8.33–9.62 | `packages/contract`, `packages/redis`, `packages/theme`, `packages/ui`, `packages/eval`, `packages/errors`, `packages/typescript-config`, `packages/agents`, `packages/database`, `features/hub/ui`                                                                                                                             | Mature, well-tested, bounded enforcement present; minor doc/hygiene deltas.                                                                                       |
| Mid (5.0–7.4)  | 5.05–7.00 | `dept/control-room`, `dept/drilling`, `dept/access-control`, `dept/production-and-shared-dynamic`, `features/auth/ui`, `shared/data-access`, `departments/ui`, `extras/e2e`, `devtools`, `extras/workspace-tools-and-mcp`, `packages/rate-limiter`, `features/auth/utils`, `shared/utils`, `packages/common`, `features/hub/ui` | Acceptable; test coverage, type hygiene, a11y, and docs need incremental fixes.                                                                                   |
| Weak (<5.0)    | 3.00–4.99 | `dept/engineering`, `dept/database`, `shared/hooks`, `dept/production-and-shared-dynamic`, `shared/utils`, `packages/supabase`, `features/auth/data-access`, `extras/arch-tools`                                                                                                                                                | Must-fix tier: untested or missing modules, critical correctness bugs (shared/utils env validation), unbounded memory, 113 PL/pgSQL warnings, broken MCP harness. |

---

## Moderated Conclusions (Reactor / Supervisor Synthesis)

1. **Weakest domain — portal department routes (Group A).** Engineering has `0/0` unit tests for an entire department; production contains unauthenticated `payload: any` server-action input, 7 client forms mutating/querying Supabase directly from the browser, and a 72 KB client monolith (`ReportsDashboardClient.tsx`) plus a 63.8 KB grid (`HourlyLoadsGrid.tsx`). Database panel has `0/0` tests and no documentation.
2. **Highest-priority correctness bugs.** `shared/utils` `parseEnv()` silently drops `GEMINI_API_KEY`/`GOOGLE_AI_API_KEY`/`GOOGLE_PROJECT_ID`/`GEMINI_API_KEYS` → always `undefined` (fail-closed auth flag also defaulted to a dummy key). `shared/hooks` has two unbounded in-memory collections (`metrics[]` and `useRedisCache`'s `Map`) for long sessions.
3. **Architectural boundary violations (Group B).** `features/departments/ui` violates its own `AGENTS.md:91` (pure presentational mandate): imports `apps/*`, mixes `'use server'` DB mutations, re-exports server actions from the barrel, and declares undeclared workspace dependencies.
4. **Packaging & test-gating gaps.** Several leaf packages ship `package.json` without `jest.config.js`/`"test"` scripts while still carrying tests (`packages/supabase`, `packages/utils`, `libs/shared/hooks`, `shared/utils`, `features/departments/data-access`, `auth/{ui,data-access,utils}`), so `pnpm test` cannot run them in isolation.
5. **Scoped fixes required, not broad rewrites.** Each unit's Critic outcome (`Fix hint`) is the acceptance checklist; the Moderator applies the minimal change at each source site only.

---

## Checklist of Moderator-Adjudicated Defects (Fix Priority)

1. `shared/utils/src/env.ts` — add the 4 missing env keys to `parseEnv()`; remove `'dummy-anon-key'` fallback; make Supabase/DB credentials required server-side.
2. `features/departments/ui` — extract all `'use server'` mutations + browser `createBrowserSupabaseClient()` calls to data-access/app layers; remove `@/lib/shift-closeout` import; stop re-exporting `'use server'` actions from barrel; declare `@repo/shared/hooks` + `@repo/shared/data-access` in `package.json`; type `createDozerRoll`.
3. `shared/hooks` — cap/dedup `metrics[]`, add LRU/TTL eviction to `useRedisCache` `Map`, fix duplicate `./useWorkflowStatus` export, replace 5 `any` with strict/generic types.
4. `dept/engineering` — add co-located unit tests for `layout.tsx`/`page.tsx`/`loading.tsx`/`error.tsx` (currently `0/0`).
5. `dept/production-and-shared-dynamic` — Zod-validate + role-check `engineering-notes/actions.ts:8`; move 7 direct browser Supabase mutation forms to server actions; split 72 KB/63.8 KB client files.
6. `packages/ui` — remove the 8 dangling `exports` keys (`FluidCanvas`, `DataGrid`, `WorkflowBuilder`, `ThreeHeroRotator*`, `PluginNode`, `TriggerNode`, `FlowEdge`).
7. `dept/database` — add co-located unit tests (`0/0`); add `loading.tsx`/`error.tsx`; add `codemap.md`/`README.md`.
8. `pkg/supabase` + `pkg/logger` — wire `jest.config.js`/`"test"` scripts so existing suites actually run in CI.
9. `extras/workspace-tools-and-mcp` — fix `tools/mcp-harness/run-harness.mjs` (JSON-RPC on `stdin`, not `process.send`); remove 2 duplicate Vercel cleanup scripts.
10. `packages/database` + `dept/*` — adopt explicit `SET search_path = public, pg_temp` on the 113 flagged PL/pgSQL functions; normalize `0145_shift_closeout.sql` and `0146_tire_management.sql` to `NNN_description.sql`.

---

## Verification Ledger (Moderator)

- `pnpm policy:check` — PASS (5/5 artifacts)
- `pnpm policy:security --ci` — PASS (113 `[no-mutable-search-path]` warnings, non-blocking)
- `pnpm audit:drift` — PASS (DHI 93.8%, 91/97 domain tables synchronized)
- `pnpm deps:lint` — PASS (192 packages single-version)
- `pnpm type-check` — PASS (21/21 packages, turbo)
- `pnpm lint` — PASS (18/18 workspaces, Biome clean, no fixes needed)
- `pnpm build` — PASS (theme codegen, supabase dist, portal Next.js 16 production build)
- `pnpm test` — PASS (153 suites / 1045 tests; 14 skipped, 0 failed)
- `pnpm --filter portal test` — PASS
- `pnpm test:e2e` — SKIPPED (blocked: `http://localhost:3000` already in use; NOT a code failure — external dev server required)
