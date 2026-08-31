# Agent Tracer — Archive

Pre-August-2026 entries and older archived changes. Entries covering only machine-local
config files (`~/.*`), read-only audits with no code changes, or external tool installs
with no repo impact have been removed during the 2026-08-31 tracer cleanup.

---

## 2026-08-21T10:30:00Z — Bundle: UniverSheet Barrel Fix & Duplicate Chunk Investigation

- **Purpose**: Fix `@univerjs` (7 MB) being pulled into every page via barrel re-export; investigate Turbopack duplicate chunks.
- **Changes**:
  - `libs/features/departments/ui/src/index.ts`: Removed `export * from "./tools/UniverSheet"` — was defeating `next/dynamic` code splitting.
  - `features/hub/components/CoreOperationalModules.tsx`: Removed unused `Filter` import.
  - `app/hub/page.tsx`: Removed unused `DepartmentCard` and `Boxes` imports.
  - **Finding**: Duplicate 599 KB chunks are a Turbopack route-group limitation — `@repo/contract` Zod schemas duplicated across route groups.

## 2026-08-21T10:09:00Z — Global Theme: Translucent Liquid Glass Department Panels

- **Changes**:
  - `packages/theme/src/css/variables.css`: `--color-cloud` → `rgba(255,255,255,0.65)`.
  - `packages/theme/src/css/cards.css`: All department cards to `backdrop-filter: blur(20px)`, translucent banner gradients, hairline glass borders.

## 2026-08-21T10:04:00Z — Hub: Interactive Core Operational Modules Component

- **Changes**:
  - `apps/portal/features/hub/components/CoreOperationalModules.tsx` (NEW): Quick search, category filter pills, pinned priority sorting, empty state fallbacks.
  - `apps/portal/app/hub/page.tsx`: Replaced static grid with `<CoreOperationalModules />`.

## 2026-08-21T09:33:00Z — EXPLAIN ANALYZE Query Plan Audit & Composite Partition FK Validation

- **Changes**:
  - `tools/explain-query-plans.cjs` (NEW): Static AST scanner verifying `PARTITION BY RANGE` PK composition and composite FK alignment.
  - `package.json`: Added `audit:explain` script.
  - `documentation/03-audit-reports/explain-query-plans-report.md` (NEW): 100% composite FK alignment confirmed.

## 2026-08-21T09:30:00Z — Portal Performance Deep Dive: Full Optimization Sweep

- **Changes**:
  - Deleted dead `FeedbackWidget.tsx` (old) and `PerformanceOptimizations.tsx`.
  - `components/LCPObserver.tsx`: `PerformanceObserver` guarded behind `isDev`.
  - `components/system/SystemTray.tsx`: Polling → React Query (`refetchInterval: 60s`, `staleTime: 30s`).
  - `components/WebVitalsReporter.tsx`: Debounced sessionStorage writes; fixed hook cleanup.
  - `components/HeaderWidgets.tsx`: `React.lazy` → `next/dynamic`.
  - `app/ReactQueryProvider.tsx`: `staleTime` → 5 min, `gcTime` → 10 min.
  - `app/layout.tsx`: `PerformanceListener` gated behind dev-only.
  - React.memo: `DepartmentCard`, `HourlyLoadsGrid`, `Sparkline`, `MachineOperationsList`, `EngineeringNotesList`.
  - Test fixes: `WeatherWidget.test.tsx` (mock fetch), `DepartmentCard.test.tsx` (useRouter mock).
- **Verification**: All 93 suites / 687 tests passing. `pnpm quality` 100%.

## 2026-08-21T08:57:00Z — Taskbar Migration: Feedback Widget & Weather Widget Removal

- **Changes**:
  - `apps/portal/components/FeedbackWidget.tsx`: `variant="header"` support with top glass taskbar pill trigger.
  - `apps/portal/components/HeaderWidgets.tsx`: Replaced `WeatherWidget` with `FeedbackWidget`.
  - `apps/portal/components/ClientOverlays.tsx`: Removed `FeedbackWidget` from bottom-right overlays.
  - `apps/portal/app/(departments)/[department]/page.tsx`: Removed `WeatherWidget` dynamic import and weather blocks.

## 2026-08-21T08:05:00Z — LCP Preloading & Render Priority

- **Changes**:
  - `apps/portal/app/layout.tsx`: `<link rel="preload">` for hero background with `fetchpriority="high"`.
  - `apps/portal/components/RouteBackground.tsx`: `fetchPriority="high"` + `priority` on `<Image>`.

## 2026-08-21T08:00:00Z — App Router: ClientOverlays SSR Isolation

- **Changes**:
  - `apps/portal/components/ClientOverlays.tsx` (NEW): Client Component isolating all `ssr: false` dynamic imports from `RootLayout`.
  - `apps/portal/app/layout.tsx`: Replaced separate overlay nodes with `<ClientOverlays />`.

## 2026-08-21T06:57:00Z — RLS Policy Audit 100% Sign-Off

- **Changes**:
  - `pnpm audit:rls`: 100 migration files, 81 tables — 100% RLS coverage, 0 critical findings.
  - Audit walkthrough artifact created.

## 2026-08-21T06:52:00Z — Floating UI: Visibility Toggles & Z-Index Standardization

- **Changes**:
  - `FeedbackWidget.tsx`: `isVisible` toggle; z-index `z-[9900]`.
  - `LCPObserver.tsx`: `isMinimized` toggle collapsing to `📊 LCP: XXms` badge at `z-[9999]`.
  - `app/layout.tsx`: Converted overlays to `next/dynamic({ ssr: false })`.

## 2026-08-19T07:20:00Z — Engineering 100% + Tire Audit Export + Production Department

- **Changes**:
  - `apps/portal/app/api/export/tires/route.ts` (NEW): Rate-limited export (fleet/inspections/scrap/all, CSV+JSON).
  - `TireManagementDashboard.tsx`: `Export Audit Log` dropdown.
  - `documentation/02-system-wiki/engineering-department.md`: Signed off 100%.
  - `documentation/02-system-wiki/production-department.md` (NEW): RoM coal, overburden, yield reconciliation SOPs; 94% completeness.
- **Verification**: 13 suites, 76 tests passing.

## 2026-08-19T07:05:00Z — Engineering: Tire Management, Predictive MTBF & Draft Caching

- **Changes**:
  - `packages/contract`: `tire-management.schema.ts` + `types.ts` (NEW).
  - `libs/.../engineering/tires/`: `actions.ts`, `TireManagementDashboard.tsx`, `TireWearCurveChart.tsx`, `TireInspectionModal.tsx`, `TireReplacementModal.tsx`.
  - `libs/.../engineering/breakdowns/`: MTTR vs MTBF chart, Automated Preventative Service Triggers panel.
  - `BookInForm.tsx` + `BookOutForm.tsx`: `localStorage` draft caching with presets.
- **Verification**: 13 suites, 76 tests passing.

## 2026-08-19T06:15:00Z — Control Room 100% & Engineering Department Baseline

- **Changes**:
  - `documentation/02-system-wiki/control-room-department.md`: 100% completion confirmed across all 8 sub-systems.
  - `documentation/02-system-wiki/engineering-department.md` (NEW): HME workshop, breakdown lifecycle, tire telemetry, MTTR SLAs, SOPs.

## 2026-08-18T14:45:00Z — Staging Compose Simulation & GitHub Actions Smoke Test

- **Changes**:
  - `apps/portal/docker/Dockerfile`: Removed unused `python3 make g++` from pruner stage.
  - `.dockerignore`: Added `**/node_modules`.
  - `infra/docker/compose.staging.yml` (NEW): Standalone Next.js + Nginx SSL + Redis topology.
  - `scripts/staging-local.sh` (NEW): `start|stop|restart|status|logs`.
  - `.github/workflows/deploy.yml`: Staging simulation smoke test step.
- **Verification**: Pre-flight validation passes; staging container builds via BuildKit.

## 2026-08-18T14:18:00Z — Pre-Flight Validation, Quality Gate Verification

- **Changes**:
  - `scripts/deploy.sh`: Integrated `./scripts/verify-prod-env.sh`.
  - `scripts/verify-prod-env.sh` (NEW): Validates `.env.production` keys, Node.js toolchain, standalone bundle.
  - `infra/docker/compose.staging.yml` + `scripts/staging-local.sh`: Created containerized staging topology.
  - `.agents/rules/task-parsing.md`: Added `&&` multi-task sequential delimiter rule.
- **Verification**: `pnpm quality` 100% — all gates including RLS audit (78/78) and design compliance clean.

## 2026-08-18T14:08:00Z — Next.js Standalone Build & SafetyDashboard RSC Decoupling

- **Changes**:
  - `apps/portal/next.config.mjs`: `output: "standalone"` unconditional.
  - `libs/features/departments/ui/src/index.ts`: Removed `SafetyDashboard` from client barrel.
  - `apps/portal/app/(departments)/[department]/page.tsx`: Direct Server Component import for `SafetyDashboard` with Suspense.
- **Verification**: Standalone boots on port 3099, HTTP 200. All 97 Jest suites (726 tests) passing.

## 2026-08-18T13:00:00Z — Control Room Shift Checklist & KPI Widget

- **Changes**:
  - `packages/contract/src/schemas/control-room.schema.ts` + `types/control-room.types.ts` (NEW).
  - `libs/.../control-room/ControlRoomChecklistWidget.tsx` (NEW): Live KPI, category tabs, completion timestamps, handover logging.
  - `apps/portal/app/(departments)/[department]/page.tsx`: Checklist widget mounted for control-room.
- **Verification**: 11 suites, 67 tests passing.

## 2026-08-18T12:53:00Z — Control Room System Wiki Documentation (Initial)

- **Changes**: `documentation/02-system-wiki/control-room-department.md` (NEW): Full roles, SOPs, KPIs, and operational checklists.

## 2026-08-18: Payload CMS Setup & Schema Isolation

- **Changes**:
  - `apps/cms/payload.config.ts`: `schemaName: "payload"`.
  - `apps/cms/scripts/setup.ts`: `@next/env` Node 26+ polyfill.
  - `apps/cms/payload-types.ts` (NEW): Generated TypeScript types.
  - Seeded `admin@plantcor.com` + default departments in `payload` schema.

## 2026-08-18: Backend Architecture Visualizer in Overview App

- **Changes**:
  - `apps/overview/app/sections/BackendArchitecture.tsx` (NEW): React Flow — service nodes, animated edges, topology layers, inspector drawer.
  - `apps/overview/lib/data.ts`: `BACKEND_SERVICES` + `BACKEND_CONNECTIONS`.
  - `apps/overview/app/page.tsx`: `Backend Connections` tab.

## 2026-08-18: Nx AI Agent Config Sync

- **Changes**: `pnpm nx configure-ai-agents` — all agents (claude, codex, copilot, cursor, gemini, opencode) synchronized with Nx 22.7.5.

## 2026-08-18: cSpell Integration & Domain Vocabulary

- **Changes**:
  - `pnpm-workspace.yaml` + `package.json`: `cspell: catalog:` added; `lint:spelling` in `quality` chain.
  - `cspell.json`: References `project-words.txt`; `AGENT_TRACER.md` excluded.
  - `project-words.txt` (NEW): 316 domain terms (SCADA, satellite/NDVI/SWIR, mining safety, tool names).
  - `packages/README.md`: Fixed `pretttier-config` typo.
- **Verification**: 838 files, 0 issues.

## 2026-08-18: Database Migrations Sync & Control Room Component Migration

- **Changes**:
  - `packages/supabase/migrations/`: Synced 050–095 from `packages/database/migrations/` (95/95 parity).
  - Control Room components relocated to `libs/features/departments/ui/src/control-room/`.
  - `FuxaFrame.tsx`: Network online/offline listeners, resilient cache fallback.

## 2026-08-18: FUXA Initial Config & Migration Sync

- **Changes**:
  - `apps/portal/.env`: `NEXT_PUBLIC_FUXA_URL` configured.
  - `packages/supabase/migrations/`: 050–095 aligned with database package.

## 2026-08-18: Codegen Prettier Post-Hooks

- **Changes**:
  - `apps/portal/scripts/generate-openapi-spec.js`: Prettier post-formatter.
  - `packages/theme/sd.config.mjs`: Post-build Prettier pass on Style Dictionary outputs.

## 2026-08-18: Workspace Initialization

- **Changes**:
  - `pnpm install`: 32 workspace projects, 2966 packages. `packages/contract/package.json` drift resolved.
  - `.env` + `apps/portal/.env`: Materialized from templates.
  - `node tools/apply-project-tags.cjs`: 31 `project.json` files written; scope tags applied.
- **Verification**: `format:check`, `lint:root`, `deps:lint`, `nx show projects` all exit 0.

## 2026-08-17: Langfuse Tracing & Agent Instrumentation

- **Changes**:
  - `.agents/skills/langfuse/` (NEW): Langfuse skill.
  - `packages/agents/src/langfuse.ts` (NEW): Langfuse client singleton; `SubagentCoordinator` instrumented.
  - `scripts/test-langfuse-tracing.mjs` (NEW): Multi-agent trace script.
  - `package.json`: `langfuse` devDependency pinned.
- **Verification**: Live trace delivered to Langfuse US Cloud.

## 2026-08-17: Dev Infrastructure & Import Path Fixes

- **Changes**:
  - `scripts/dev.sh`: `127.0.0.1` port detection; env loading from `$REPO_ROOT/apps/portal/.env`.
  - `libs/.../control-room/CloseShiftModal.test.tsx`: `~/lib/...` → `@/lib/...` import normalization.
  - `packages/supabase/seed.sql`: Null-guard on `hourly_loads.machine_id`.
  - `config/generate-certs.sh`: Absolute `$REPO_ROOT/certs` path.
  - `.gitignore`: `certs/` excluded.

## 2026-08-17: MCP Registry Sync (Repo Config Files Only)

- **Purpose**: Sync `config/tools/mcp.json`, `.vscode/mcp.json`, and `.agents/mcp_config.json` to match the full 13-server set.
- **Changes** (repo files only):
  - `config/tools/mcp.json`: Synced to all 13 servers.
  - `.vscode/mcp.json` (NEW): Created with 13 servers.
  - `.agents/mcp_config.json` (NEW): Created with 13 servers.
