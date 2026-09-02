# Root Workspace Agent Tracer

Entries are reverse-chronological. Each records a meaningful code or documentation change.
Operational-only actions (server restarts, read-only audits, image asset drops) are omitted.
Older entries are archived to [`docs/archive/AGENT_TRACER_archive.md`](./docs/archive/AGENT_TRACER_archive.md).

---

## 2026-09-02 — Specialized Engineering Agents & Shared Industrial Hooks Suite

- **Purpose**: Created 3 specialized domain subagents and implemented 4 high-impact shared hooks in `@repo/shared/hooks` ([libs/shared/hooks](file:///home/tim/Documents/Arch-System/libs/shared/hooks)) with full unit test coverage.
- **Created Agents**:
  - `realtime-engineer-agent`: Specializes in Supabase Realtime CDC channels and telemetry.
  - `mutation-engineer-agent`: Specializes in React 19 `useOptimistic` transitions and Server Action lifecycles.
  - `resilience-engineer-agent`: Specializes in open-pit network state detection and control-room keybindings.
- **Implemented Hooks**:
  - `useSupabaseRealtime`: Declarative PostgreSQL CDC subscription hook with filter querying and unmount cleanup.
  - `useOptimisticAction`: React 19 `useOptimistic` + `useTransition` server action wrapper with `@repo/errors` rollback boundaries.
  - `usePitConnectivity`: Mining pit connectivity sensor combining `navigator.onLine` with jittered heartbeat health pings.
  - `useCommandScope`: Input-guarded industrial keyboard shortcut manager.
- **Verification**:
  - `portal:test` (4 new hook test suites passed, 9/9 tests passed).
  - `pnpm type-check` ✅ (All 26 workspaces passed).
  - `pnpm quality` ✅ (Full gate passed with exit code 0).
  - `pnpm audit:drift && pnpm audit:compliance` ✅ (100% compliant).
- **What the Next Agent Should Know**: Import these hooks directly from `@repo/shared/hooks` anywhere in `apps/portal` or `apps/overview`.

## 2026-09-02 — Satellite Backend Endpoints, Schemas & Table Removal

- **Purpose**: Fully removed Satellite Monitoring backend endpoints, API routes, Inngest cron jobs, Zod contracts, and PostgreSQL tables across `@[packages]` and `@[apps/portal]`.
- **Changes**:
  - `packages/database/migrations/151_remove_satellite_monitoring.sql` (NEW): Dropped `satellite_insar_deformations` table with `CASCADE` and cleaned `departments` table.
  - `packages/supabase/migrations/151_remove_satellite_monitoring.sql` (NEW): Synchronized migration in Supabase.
  - `packages/contract`: Removed `satellite.schema.ts`, `satellite.schema.test.ts`, and all satellite exports from `packages/contract/src/index.ts`.
  - `apps/portal`:
    - Removed `app/api/telemetry/satellite/` routes.
    - Removed `lib/jobs/insar-scene-ingestion.ts`, `lib/monitoring/satellite-data.ts`, `lib/monitoring-api.ts`, and unreferenced monitoring components.
    - Unregistered `insarSceneIngestionFn` from `app/api/inngest/route.ts`.
    - Removed `satellite-monitoring` from proxy route gating in `apps/portal/server/proxy.ts`.
    - Pruned satellite sub-pages (`sar`, `satellite`, `highres`, `hyperspectral`) and cleaned `apps/portal/app/(departments)/[department]/page.tsx`.
  - `libs/features`: Cleaned satellite components in `libs/features/departments/ui/` and exports in `libs/features/departments/ui/src/index.ts`.
- **Verification**:
  - `pnpm nx run @repo/database:test:migration-rollback` ✅ (108 migrations validated, 0 errors).
  - `pnpm --filter @repo/contract test` ✅ (100% pass).
  - `pnpm --filter @repo/departments/ui test` ✅ (15 suites passed).
  - `pnpm type-check` ✅ (All 26 workspaces passed).
  - `pnpm quality` ✅ (Full gate passed with exit code 0).
  - `pnpm audit:drift && pnpm audit:compliance` ✅ (100% compliant).
- **What the Next Agent Should Know**: Satellite monitoring backend and database structures are completely decommissioned.

## 2026-09-02 — Satellite Monitoring UI & Navigation Pruning

- **Purpose**: Removed Satellite Monitoring department card and shortcuts from portal navigation and registries while preserving underlying database schema and historical telemetry data.
- **Changes**:
  - `libs/features/departments/data-access/src/departments.ts`: Removed `satellite-monitoring` entry from the canonical `DEPARTMENTS` array.
  - `apps/portal/components/CommandBar.tsx`: Removed `dept-satellite` navigation command item.
  - `libs/features/departments/data-access/src/departments.test.ts`: Updated department registry unit test assertions.
- **Verification**: `pnpm nx run-many -t test` ✅ (All 11 workspace test projects passed).
- **What the Next Agent Should Know**: Satellite Monitoring is excluded from Hub cards and CommandBar navigation. Underlying DB tables and routes remain intact.

## 2026-09-02 — Monorepo Complexity Removal & Debloat Execution

- **Purpose**: Executed system-wide debloat and complexity elimination across `@[packages]` and `@[apps/portal]` via `system-simplifier-agent`.
- **Changes**:
  - `apps/portal/components/accessibility/A11yDevTools.tsx` (DELETED): Removed dead development accessibility component unreferenced across the codebase.
  - `apps/portal/components/performance/VirtualList.tsx` (DELETED): Removed uncalled virtual list component and pruned empty directory `apps/portal/components/performance`.
  - `package.json`: Pruned unreferenced `@axe-core/react` dependency.
  - `apps/portal/app/(departments)/drilling/drilling-operations/actions.ts`: Refactored to eliminate uncalled actions (`archiveStaleDrillOperationsAction`), replaced unsafe `any` error casts with type-safe `unknown` boundaries.
  - `{workspaceRoot}` (DELETED): Purged dangling root directory.
- **Verification**:
  - `pnpm deps:check` ✅ (0 mismatches).
  - `pnpm knip` ✅ (0 unused files, dead components pruned).
  - `pnpm type-check` ✅ (All 26 workspace projects passed).
  - `pnpm quality` ✅ (Full gate passed: lint, styles, cspell, CSS budgets, unit tests, rollback tests).
  - `pnpm audit:drift` && `pnpm audit:compliance` ✅ (100% boundary compliance).
- **What the Next Agent Should Know**: Monorepo dependencies and exports are clean with zero dead files and 100% passing quality gates.

## 2026-09-02 — System Simplifier Agent Specification & Debloat Planning

- **Purpose**: Created dedicated `system-simplifier-agent` to audit, plan (`/plan`), and execute (`/goal`) the systematic removal of unused complexity, dead code, and redundant abstractions.
- **Changes**:
  - `~/.gemini/config/plugins/agentic-council/agents/system-simplifier-agent.md` (NEW): Full agent spec and execution workflow.
  - `~/.gemini/config/plugins/agentic-council/plugin.json`: Registered `system-simplifier-agent` in the agentic council plugin.
  - `.agents/rules/system-simplification-and-debloat.md` (NEW): Workspace-level simplification and anti-bloat guidelines.
  - `implementation_plan.md`: Generated 4-phase debloating and simplification plan ready for `/goal` execution.
  - Stored persistent memory via `agent-memory store`.
- **What the Next Agent Should Know**: The `system-simplifier-agent` can be invoked or driven via `/goal` to execute Phase 1 (`pnpm knip`) through Phase 4 (`pnpm quality`).

## 2026-09-01 — Portal Department Linkage Audit & Route Rectification

- **Purpose**: Comprehensive audit and rectification of department routes, quick actions, command bar shortcuts, and navigation links across `apps/portal` and `libs/features`.
- **Changes**:
  - `libs/features/departments/data-access/src/departments.ts`: Fixed `safety` department quick actions (`/safety/daily-log` + `/safety/reports`) and `admin` quick actions (`/admin?tab=users` + `/admin?tab=departments`).
  - `apps/portal/components/nav/BottomNav.tsx`: Fixed Analytics link from broken `/executive` to canonical `/hub/executive`.
  - `apps/portal/app/(departments)/[department]/satellite/page.tsx`: Updated Executive Hub link from raw `<a>` with broken href to Next.js `<Link href="/hub/executive">`.
  - `apps/portal/components/CommandBar.tsx`: Added missing department commands (`/access-card-actions`, `/overview`, `/admin`) with proper Lucide icons.
  - `apps/overview/lib/data.ts`: Synchronized `access-card-actions` routes in system topology dataset.
  - `apps/portal/app/api/metabase/embed/route.test.ts`: Fixed `@repo/supabase/server` Jest mock to include `createServerSupabaseClient` and typed `getUserSafely` response.
  - `libs/features/departments/data-access/src/departments.test.ts` (NEW): Added comprehensive unit tests asserting route, name, and action uniqueness and formatting.
- **Verification**: `pnpm nx run-many -t test` ✅ (All 8 workspace test suites passed).
- **What the Next Agent Should Know**: Department routes are 100% verified across Hub, CommandBar, BottomNav, and System Overview.

## 2026-08-31 — Adaptive Probabilistic Early Expiration (X-Fetch) Requirements Plan (`docs/plans`)

- **Purpose**: Authored requirements-only unified plan for the X-Fetch probabilistic early expiration algorithm in `packages/redis`.
- **Changes**:
  - `docs/plans/2026-08-31-x-fetch-early-expiration-requirements.md` (NEW): Established product contract, mathematical formulation ($-\beta \cdot \delta \cdot \ln(\text{rand}()) > \text{TTL}_{\text{remaining}}$), single-flight background recomputation requirements, and Prometheus observability metrics.
- **What the Next Agent Should Know**: Next step is to invoke `ce-plan` to enrich this artifact with implementation details (`artifact_readiness: implementation-ready`).

## 2026-08-31 — Documentation Health: Coverage Thresholds, Department Manuals & Dual-Root Clarification

- **Branch**: `docs/fix-coverage-thresholds-and-dept-manuals`
- **Purpose**: Three documentation fixes from a full `/docs` + `/documentation` audit.
- **Changes**:
  - `AGENTS.md`: Corrected stale Jest thresholds (35/24/24/34 → 40/30/35/40). Added note about active CI gap: functions at ~28.47% below 35% threshold.
  - `documentation/02-system-wiki/drilling-department.md` (NEW): Full operational manual — SOPs, KPI table, 4-tier checklists.
  - `documentation/02-system-wiki/access-control-department.md` (NEW): Full operational manual — badge issuance, visitor, muster SOPs.
  - `documentation/02-system-wiki/safety-department.md` (NEW): Full operational manual — incident triage, LTI KPIs, corrective action workflow.
  - `documentation/02-system-wiki/training-department.md` (NEW): Full operational manual — induction, certification expiry, competency matrix.
  - `documentation/02-system-wiki/satellite-monitoring-department.md` (NEW): Full operational manual — SAR/InSAR alert workflow, hyperspectral SOP.
  - `docs/DOCUMENTATION_INDEX.md`: Per-topic canonical location table + 2026-11-01 migration deadline.
  - `docs/wiki/index.md`: Migration notice blocking new additions; direct to `documentation/02-system-wiki/`.
  - `documentation/README.md`: Phase 2b marked complete; target dates added for Phases 3–6.
- **What the Next Agent Should Know**: All 8 departments now have full manuals in `documentation/02-system-wiki/`. Functions coverage CI failure (28.47% vs 35%) is pre-existing. Migration deadline: **2026-11-01**.

## 2026-08-28 — `pg_graphql` Migration, PL/pgSQL Security Checks & Metabase Embed API

- **Purpose**: Safe database extension auditing, PL/pgSQL security lint rules, and rate-limited Metabase embed JWT API.
- **Changes**:
  - `packages/database/migrations/097_enable_pg_graphql.sql` (NEW): Enables `pg_graphql` in `extensions` schema with RLS compatibility and `search_path` hardening.
  - `packages/database/tests/rls_extension_safety.sql` (NEW): Assertion test for RLS isolation and `search_path`.
  - `tools/policy-compiler.cjs` + `tools/policy/security.checks.json`: Added `no-mutable-search-path` and `require-extension-schema` lint rules.
  - `apps/portal/app/api/metabase/embed/route.ts` (NEW): Signed HMAC-SHA256 JWT route for Metabase embeds; rate-limited.
  - `apps/portal/app/api/metabase/embed/route.test.ts` (NEW): 3 tests — auth, params, token signature.
- **What the Next Agent Should Know**: Metabase embed at `/api/metabase/embed?dashboardId=<id>&departmentId=<dept_uuid>`.

## 2026-08-28 — External Repository Architectural Evaluation

- **Purpose**: Evaluate six repos for adoption/discard: `metabase`, `hasura/graphql-engine`, `sqlx`, `postgres-language-server`, `pg_graphql`, `octotools`.
- **Key Decisions**: Adopt Metabase (BI embeds), `pg_graphql`, and Postgres Language Server. Discard Hasura (duplicate proxy layer). Keep SQLx optional.
- **Changes**: `docs/wiki/comparisons/REPOSITORY_EVALUATION.md` (NEW): full evaluation matrix.
- **What the Next Agent Should Know**: Decision matrix at `docs/wiki/comparisons/REPOSITORY_EVALUATION.md`.

## 2026-08-28 — FUXA: Full Reverse-Flow Resolution (6 root causes) + Prod Config

- **Purpose**: Permanently resolve FUXA SCADA "degraded mode" warning, fix broken health probe and mismatched telemetry ingest, document prod reverse-flow config.
- **Changes**:
  - `infra/docker/compose.scada.yml` (NEW): Splits FUXA out of `compose.tools.yml`; always up on `pnpm dev`. `stop_signal: SIGINT`, `stop_grace_period: 30s`, `network_mode: host` (dev only — host firewall blocks bridge→host traffic).
  - `infra/docker/compose.tools.yml`: Removed `fuxa` service.
  - `scripts/dev.sh`: Auto-boots `compose.scada.yml`; self-heal block restarts stopped `plantcor-fuxa` container.
  - `apps/portal/app/api/control-room/scada-status/route.ts`: Health probe `GET /api/health` (404) → `HEAD /` (200).
  - `apps/portal/app/api/telemetry/push/route.ts`: Removed dead `POST /api/tag` calls; Redis is system of record.
  - `apps/portal/app/api/scada/tags/route.ts` (NEW): Serves Redis telemetry cache in FUXA WebAPI shape `[{id,name,value,type}]`.
  - `apps/portal/app/api/telemetry/drilling/route.ts`: Writes drilling metrics to `telemetry:last:drill_<id>_<metric>` namespace.
  - `scripts/fuxa-gauge-grid.py` (NEW): Stdlib-only script to regenerate FUXA gauge dashboard from `/api/scada/tags`.
  - `docs/operations/FUXA_PRODUCTION_CONFIG.md`: Reverse-flow architecture section prepended; legacy push-model sections marked superseded.
  - `docs/operations/fuxa-integration-plan.md`: `userDir` persistence, host-networking rationale, WebAPI device config.
  - `.env` + `apps/portal/.env`: `NEXT_PUBLIC_FUXA_URL` pinned to `http://localhost:1881`.
  - All 13 FUXA-related tests pass.
- **What the Next Agent Should Know**: FUXA pulls `/api/scada/tags` (reverse flow) — never POST to `/api/tag`. For prod, revert to bridge networking + firewall rule. `userDir=/root/.fuxa` env must stay or dashboards are lost on container recreate.

## 2026-08-26 — Visual & Ergonomic Login Page Enhancements

- **Purpose**: Align login card with glassmorphism design system; add zero-click overwrite, rate-limit locking, and accessibility roles.
- **Changes**:
  - `apps/portal/app/(auth)/login/page.tsx`: Card border `white/40` → `bg-white/70 backdrop-blur-xl border border-black/[0.08]`.
  - `libs/features/auth/ui/src/LoginForm.tsx`: `onFocus` select-all on inputs; rate-limit input/button gating; `Loader2` spinner; `aria-live` roles.
- **What the Next Agent Should Know**: Login fully optimized for a11y, visual contrast, and autofill overwrite.

## 2026-08-26 — Fix Cache Scope Violation on Hub Layout

- **Purpose**: Resolve Next.js render crash on `/hub` — `cookies()` called inside a cached function.
- **Changes**: `apps/portal/app/hub/layout.tsx`: Call `cookies()` outside cache scope; pass `cookieList` as parameter to `getAccessibleDepartmentNames`.
- **What the Next Agent Should Know**: Never call `cookies()` or `headers()` inside `unstable_cache()` / `withCache()`. Pass as parameters.

## 2026-08-26 — Dev Server Boot Watchdog & Report System

- **Purpose**: 10-second watchdog on `scripts/dev.sh`; auto-write diagnostic `dev-report.md` on timeout or success.
- **Changes**:
  - `tools/generate-dev-report.js` (NEW): Reads `run/dev.log`, strips ANSI, parses phases, writes `dev-report.md`.
  - `scripts/dev.sh`: `tee` to `run/dev.log`; watchdog background process; report generation in `cleanup()` trap.

## 2026-08-26 — AGENTS.md Consolidated Rewrite

- **Purpose**: Synthesize from scout-agent findings into unified Repository Guidelines; align all AI config files with anchored cross-references.
- **Changes**:
  - `docs/AGENTS.md` / root `AGENTS.md` (symlinked): Full "Repository Guidelines" structure with 9 sections — architecture, commands, conventions, error handling, testing, coverage thresholds.
  - `.github/copilot-instructions.md`: Anchored links to CLAUDE.md and CONTRIBUTING.md.
  - `docs/GEMINI.md`: Authoritative docs section with AGENTS.md as first entry.
- **What the Next Agent Should Know**: Root `AGENTS.md` is a symlink to `docs/AGENTS.md`. Both are synchronized.

## 2026-08-24 — Layout Compliance & TypeScript Stability Pass

- **Purpose**: Align Tailwind layouts with DESIGN.md spacing/radius constraints; fix TS narrowing bugs on intersection types.
- **Changes**:
  - `packages/theme/src/tailwind/preset.ts`: Semantic spacing aliases (`xs`, `sm`, `md`, `lg`); `.container` 16px/24px rules.
  - `packages/theme/src/css/variables.css`: 12-column `.layout-grid` + `.card-nested-content` nested-radius solver.
  - `apps/portal/lib/errors/error-classes.ts`: Exported `AppError` base for TS type-guard narrowing.
  - `apps/portal/app/hub/error.tsx` + `hub/executive/page.tsx`: Narrowing hard-cast and `driftAlertStyle` fallback.
- **What the Next Agent Should Know**: Use `p-md` / `gap-lg` — not `p-4` / `gap-6` — on new UI.

## 2026-08-24 — Context Optimizer: Dead Code, Unused Deps & Topology Refresh

- **Purpose**: Prune dead code, remove unreferenced dependencies, eliminate duplicate exports, regenerate codebase maps.
- **Changes**:
  - `apps/portal/package.json`: Removed `@google/generative-ai` and `lenis`.
  - `apps/portal/app/(departments)/[department]/ai/actions.ts` + `lib/ai/google-ai-client.ts`: Deleted dead legacy AI files.
  - `libs/features/hub/ui/src/HeroRotator.tsx`: Removed duplicate default export.
  - `codebase-maps/`: Regenerated all topological maps.

## 2026-08-21 — Performance & Bundle Optimization Pass (Full Day)

- **Purpose**: Bundle split fixes, React.memo, interaction ergonomics, hero carousel, contract subpath migration, quality gate.
- **Changes**:
  - `libs/features/departments/ui/src/index.ts`: Removed `UniverSheet` barrel re-export (was pulling 7 MB `@univerjs` into every page).
  - `packages/contract/package.json`: Added `sideEffects: false`; all 17 barrel consumers migrated to subpath imports. 67 KB duplicate chunk reduction.
  - `libs/features/hub/ui/src/HeroRotator.tsx`: Refactored to two-column department carousel with photo cards, category pills, and play/pause controls.
  - `apps/portal/app/ClientProviders.tsx`: Removed `SmoothScrollProvider` (Lenis) — cosmetic rAF overhead.
  - `app/layout.tsx`: Reduced speculation rules to 5 routes at `moderate` eagerness. Gated `PerformanceListener` behind dev-only.
  - `apps/portal/app/ReactQueryProvider.tsx`: `staleTime` → 5 min, `gcTime` → 10 min.
  - `apps/portal/components/ClientOverlays.tsx` (NEW): Isolated `ssr: false` dynamic imports from `RootLayout` Server Component.
  - `apps/portal/components/RouteBackground.tsx`: `fetchPriority="high"` + `priority` on hero background.
  - `apps/portal/app/layout.tsx`: `<link rel="preload">` for hero background asset.
  - React.memo applied to 8 components: `DepartmentCard`, `HourlyLoadsGrid`, `Sparkline`, `MachineOperationsList`, `EngineeringNotesList`, `ControlRoomSummaryGridClient`, `NonControlRoomSummaryGridClient`, `ShiftCoverageWidget`.
  - `ShiftCoverageSectionClient`: Converted to `next/dynamic({ ssr: false })` — 22 KB chunk, control-room only.
  - Interaction ergonomics: `onFocus` select-all on `DailyLogForm` inputs; autofocus on `EngineeringNotesForm`; `Cmd+K`/`/` shortcut on hub module search; `Cmd+Enter` submit + `Escape` close on `FeedbackWidget`.
  - State guard optimizations in `useThrottledState`, `useOfflineQueue`, `SystemClock`, `SystemTray`, `useSystemMetrics` — skip re-renders on unchanged values.
  - Fixed 4 "Maximum update depth exceeded" re-render loops in `useAutoSave`, `SystemClock`, `SystemTray`, `useSystemMetrics`.
  - `apps/portal/components/system/SystemTray.tsx`: Polling replaced with React Query (`refetchInterval: 60s`).
  - `packages/theme/src/css/cards.css` + `variables.css`: All department cards/panels to frosted glass (`bg-white/65 backdrop-blur-xl`).
  - `packages/theme/src/css/borders.css` + `packages/ui/src/components/Divider.tsx` + `BorderBox.tsx`: 9 industrial border techniques; Storybook stories; 13 unit tests.
  - `cspell.json` + `project-words.txt` (316 terms): cSpell integrated into `pnpm quality` chain — 0 issues across 838 files.
  - `@repo/contract` `no-restricted-imports` ESLint rule added to `packages/eslint-config/react-internal.js`.
  - `documentation/03-audit-reports/explain-query-plans-report.md` (NEW): 100% composite foreign key alignment audit report.
  - `tools/explain-query-plans.cjs` (NEW): Static AST scanner for partition key / composite FK alignment.
- **Verification**: `pnpm quality` 100%. All 93 test suites / 687 tests passing. Build: 214 chunks, 21 MB, 0 duplicate `@repo/contract` barrel refs.
- **What the Next Agent Should Know**: Build production with Webpack (`pnpm nx build portal`) — Turbopack produces 3 × 576 KB duplicate chunks due to route-group splitting.

## 2026-08-19 — Engineering Department 100% + Production Department Audit

- **Purpose**: Complete Engineering Department, implement tire audit export, establish Production Department documentation and audit.
- **Changes**:
  - `apps/portal/app/api/export/tires/route.ts` (NEW): Rate-limited export API for `fleet`, `inspections`, `scrap`, and `all` in CSV/JSON.
  - `libs/features/departments/ui/src/engineering/tires/TireManagementDashboard.tsx`: `Export Audit Log` dropdown.
  - `packages/contract`: `tire-management.schema.ts` + `tire-management.types.ts` (NEW).
  - `libs/features/departments/ui/src/engineering/tires/`: Full tire workflow — `actions.ts`, `TireWearCurveChart.tsx`, `TireInspectionModal.tsx`, `TireReplacementModal.tsx`.
  - `libs/features/departments/ui/src/engineering/breakdowns/`: MTTR vs MTBF chart, Automated Preventative Service Triggers panel.
  - `BookInForm.tsx` + `BookOutForm.tsx`: `localStorage` draft caching with draft indicator, clear button, quick-select presets.
  - `documentation/02-system-wiki/engineering-department.md`: Signed off at 100%.
  - `documentation/02-system-wiki/production-department.md` (NEW): RoM coal extraction, overburden stripping, yield reconciliation SOPs.
- **Verification**: 13 suites, 76 tests passing. Lint + type-check clean.

## 2026-08-19 — Control Room 100% Sign-Off

- **Changes**:
  - `apps/portal/app/api/control-room/scada-status/route.ts` + shift-completeness route: Wired to DB.
  - `documentation/02-system-wiki/control-room-department.md`: Signed off 100% across all 8 sub-systems.
- **What the Next Agent Should Know**: Control Room is fully operational and documented.

## 2026-08-18 — Staging Pipeline, Standalone Build & CI Integration

- **Purpose**: Configure Next.js standalone output, staging compose simulation, pre-flight validation, and GitHub Actions smoke test.
- **Changes**:
  - `apps/portal/next.config.mjs`: `output: "standalone"` unconditional.
  - `libs/features/departments/ui/src/index.ts`: Removed `SafetyDashboard` from client barrel (RSC `next/headers` decoupling).
  - `scripts/verify-prod-env.sh` (NEW): Production pre-flight validation.
  - `infra/docker/compose.staging.yml` (NEW): Staging topology — Next.js standalone + Nginx SSL + Redis.
  - `scripts/staging-local.sh` (NEW): `start|stop|restart|status|logs` for staging stack.
  - `.github/workflows/deploy.yml`: `Staging Compose Simulation Smoke Test` step added.
  - `docs/DEPLOYMENT.md`: Self-hosted standalone workflow, systemd unit, Nginx reverse proxy config.
- **Verification**: `pnpm quality` 100% green. Standalone artifact boots on port 3099 HTTP 200.
- **What the Next Agent Should Know**: Standalone artifact at `node apps/portal/.next/standalone/apps/portal/server.js`.

## 2026-08-18 — Control Room Shift Checklist & KPI Widget

- **Changes**:
  - `packages/contract/src/schemas/control-room.schema.ts` + `types/control-room.types.ts` (NEW): Zod schemas for checklist and shift report.
  - `libs/features/departments/ui/src/control-room/ControlRoomChecklistWidget.tsx` (NEW): Live KPI metrics (<60s alarm, <30s ack, ≥99.9% uptime), category tabs, completion timestamps, handover logging.
  - `apps/portal/app/(departments)/[department]/page.tsx`: Dynamically mounted checklist widget for control-room.
- **Verification**: 11 suites, 67 tests passing. Type-check + lint clean.

## 2026-08-18 — Payload CMS Setup & Schema Isolation

- **Purpose**: Resolve Node 26 ESM/CJS interop issues; isolate Payload tables in `payload` schema; generate TypeScript types.
- **Changes**:
  - `apps/cms/payload.config.ts`: `schemaName: "payload"` on `postgresAdapter`.
  - `apps/cms/scripts/setup.ts`: `@next/env` default import polyfill for Node 26+.
  - `apps/cms/payload-types.ts` (NEW): Generated TypeScript types.
  - Seeded admin (`admin@plantcor.com`) and default departments in `payload` schema.
- **Verification**: CMS type-check, lint, build — 0 errors.

## 2026-08-18 — Nx AI Agent Config Sync & cSpell Integration

- **Changes**:
  - `pnpm nx configure-ai-agents` run — all agents (claude, codex, copilot, cursor, gemini, opencode) up-to-date.
  - `cspell.json` + `project-words.txt` (NEW): 316 domain terms; `lint:spelling` added to `quality` chain. `AGENT_TRACER.md` excluded from spell-check.
  - `packages/README.md`: Fixed `pretttier-config` typo.
  - `scripts/dev.sh`: Loopback `127.0.0.1` port detection; env loading from `$REPO_ROOT/apps/portal/.env`.
  - `packages/theme/sd.config.mjs` + `apps/portal/scripts/generate-openapi-spec.js`: Prettier post-hooks on codegen outputs.
  - `config/generate-certs.sh`: Absolute `$REPO_ROOT/certs` path. `.gitignore`: `certs/` added.
- **Verification**: `pnpm quality` exit 0. All quality gates green.

## 2026-08-18 — Backend Architecture Visualizer & Overview App

- **Changes**:
  - `apps/overview/app/sections/BackendArchitecture.tsx` (NEW): Interactive React Flow canvas — service nodes, animated wire edges, topology layers, flow-type filters, inspector drawer.
  - `apps/overview/lib/data.ts`: `BACKEND_SERVICES` + `BACKEND_CONNECTIONS` data contracts.
  - `apps/overview/app/page.tsx`: `Backend Connections` tab registered.
- **Verification**: Overview type-check, lint, build — 0 errors.

## 2026-08-18 — Database Migrations Sync & Control Room Component Migration

- **Changes**:
  - `packages/supabase/migrations/`: Synced migrations 050–095 from `packages/database/migrations/` (1:1 parity, 95/95).
  - `libs/features/departments/ui/src/control-room/`: Relocated Control Room components from `apps/portal`.
  - `@repo/contract` form schemas/types extended.
  - `libs/features/departments/ui/src/control-room/FuxaFrame.tsx`: Strong typing, `online`/`offline` network listeners, resilient cache fallback.
- **Verification**: `pnpm quality` exit 0.

## 2026-08-17 — Langfuse Tracing Integration

- **Changes**:
  - `.agents/skills/langfuse/` (NEW): Langfuse skill installed.
  - `packages/agents/src/langfuse.ts` (NEW): Langfuse client singleton.
  - `packages/agents`: `SubagentCoordinator` instrumented with trace/generation lifecycle.
  - `scripts/test-langfuse-tracing.mjs` (NEW): Sample multi-agent trace script.
  - `apps/portal/.env`: Langfuse observability keys added.
- **Verification**: `pnpm --filter @repo/agents type-check` — 0 errors. Live trace delivered to Langfuse US Cloud.

## 2026-08-17 — Dev Infrastructure & Import Path Fixes

- **Changes**:
  - `scripts/dev.sh`: Loopback port detection; env var loading paths.
  - `libs/features/departments/ui/src/control-room/CloseShiftModal.test.tsx`: Normalized `~/lib/shift-closeout` → `@/lib/shift-closeout`.
  - `packages/supabase/seed.sql`: Null-guard on `hourly_loads.machine_id` constraint.
  - `~/.local/bin/supabase` (NEW): XDG launcher for Supabase CLI binary.
  - `.gitignore`: `certs/` excluded.

## 2026-09-01 — Documentation Specialist Agent Deployment & Complete Docs Harmonization

- **Author**: Antigravity Documentation Specialist Agent
- **Mandate**: Review, audit, fully update, and harmonize all documentation across `docs/`, `documentation/`, and Rule 10 living system repositories.
- **Changes**:
  - `.agents/skills/documentation-specialist/` (NEW): Production-grade documentation specialist skill and framework.
  - `system-wiki/` (NEW): Living system architecture, runtime guidelines, environment configs, and department domain workflows (Rule 10 compliance).
  - `agentic-system-wiki/` (UPDATED): Living multi-agent protocols, 4-agent critique council contracts, MCP integrations, and skill registry (Rule 10 compliance).
  - `storybook/` (NEW): Living UI component states, OKLCH visual contracts, and accessibility test specifications (Rule 10 compliance).
  - `documentation/` (EXPANDED): Full structure populated with index READMEs across all categories (`00-core`, `01-operations`, `05-wiki`, `06-archives`, `08-guides`, `09-tools`, `10-references`).
  - `docs/DOCUMENTATION_INDEX.md`: Updated directory topology, fixed invalid relative paths, corrected project nomenclature, and synchronized quick lookup references.
  - `docs/wiki/`: Eliminated stale `file://` URIs and normalized relative markdown links across `quick-reference.md`, `project-overview.md`, `nx-monorepo.md`, and `breakdown/`.
  - `docs/DEPLOYMENT.md` & `docs/archive/LIQUID_GLASS_CHECKLIST.md`: Corrected relative target links.
- **Verification**: Complete link sweep script passed with 0 unresolved paths. Rule 10 repositories verified.

## 2026-09-01 — Agentic System Expert Deployment, Prompt Engineering Rule & Quality Gate Remediation

- **Author**: Antigravity Multi-Agent Orchestrator
- **Mandate**: Deploy Agentic System Expert skill, codify prompt engineering rules (RISEN framework), execute Option 1 (pnpm quality), Option 2 (domain workflows), and Option 3 (SVG codebase generator).
- **Changes**:
  - `.agents/skills/agentic-system-expert/` (NEW): Specialization framework for multi-agent coordination, MCP tool integration, and Langfuse tracing.
  - `.agents/rules/agent-prompting-engineering.md` (NEW): Comprehensive RISEN prompt engineering rules for agent/subagent prompting.
  - `apps/portal/lib/observability/metrics.ts`: Fixed broken deep import `@repo/redis/src/stats` -> `@repo/redis`.
  - `packages/redis/jest.config.js`: Corrected test runner to use `@swc/jest` instead of missing `ts-jest` preset.
  - `packages/redis/tests/cache.test.ts`: Calibrated computation delta for probabilistic X-Fetch early expiration tests.
  - `apps/portal/app/api/metabase/embed/route.test.ts`: Fixed `getUserSafely` and `createServerSupabaseClient` mock signatures.
  - `project-words.txt`: Added domain words (`xfetch`, `distroless`, `httpx`, `smol`) for zero-warning CSpell validation.
- **Verification**: `pnpm quality` executed across all 27 monorepo projects with 100% passing tests and exit code 0.
