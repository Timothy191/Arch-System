# Arch-System Consolidated Agent Tracer Ledger (`AGENTS-TRACERRS.md`)

> **Single Source of Truth (SSoT)**: Consolidated from 24 distributed `AGENT_TRACER.md` files (`root`, `apps/portal`, `packages/*`, `libs/*`, `tools`, `e2e`, `scripts`, `docs/archive`) to eliminate context fragmentation and enforce a single immutable audit ledger across the monorepo.

---

## [2026-11-09T21:25:00+02:00] - Monorepo Shared Function, Component & Hook Consolidation (20 SSoT Clusters Across 5 Tiers)

- **EARS Spec (`docs/specs/shared-function-consolidation.spec.md`)**: Authored formal specification auditing 1,017 production files and defining 20 high-confidence duplication clusters vs. 4 intentional architectural separations (`getCurrentShift`, `normalizeRole`, `escapeHtml`, `usePitConnectivity`).
- **Tier 1 — Server Actions & API Route Helpers (`apps/portal`)**:
  - Consolidated 6 duplicated `assertAdmin()` implementations into `apps/portal/features/admin/actions/shared.ts` across `fleet.ts`, `minerals.ts`, `sites.ts`, and `targets.ts`.
  - Consolidated 3 `assertAccessControlRole()` / `ACCESS_CONTROL_WRITE_ROLES` helpers into `apps/portal/app/(departments)/access-control/actions/shared.ts` across `print-cards/actions.ts` and `qr-codes/actions.ts`.
  - Extracted `sanitizeCsvCell`, `prepareExportRequest`, `resolveExportDateRange`, `wantsCsv`, `exportDatabaseErrorResponse`, `createCsvExportResponse`, and `resolveDepartmentId` into `apps/portal/lib/api/export-helpers.ts` across `machines/route.ts`, `fuel-logs/route.ts`, and `production/route.ts`.
  - Unified Redis Proxy timing-safe bearer auth into `authorizeRedisProxyRequest()` in `apps/portal/lib/api/telemetry-auth.ts` across `executions/route.ts` and `workflows/route.ts`.
  - Extracted BullMQ queue factory & Redis URL parser (`getWorkflowQueue`, `getQueueRedisConnectionOptions`, `WORKFLOW_QUEUE_NAME`) into `apps/portal/lib/workflows/queue.ts` across `dispatch/route.ts` and `jobs/[jobId]/route.ts`.
- **Tier 2 — UI Components, Sparklines, Error Boundaries & Skeletons (`packages/ui`, `libs/`, `apps/portal`)**:
  - Exported `ARCH_LOGO_PATH` and `ARCH_LOGO_VIEWBOX` from `packages/ui/src/components/Logo.tsx` and replaced 9 hardcoded 740-char SVG path strings across `HeroRotator.tsx`, `HeroCardContent.tsx`, `DepartmentCard.tsx`, `Sparkline.tsx`, and `AlertPanel.tsx`.
  - Extracted `GoldenTelemetrySparkline` and `buildSparklinePoints` into `apps/portal/components/telemetry/GoldenTelemetrySparkline.tsx`, eliminating >500 lines of duplicated SVG sparkline code across `ControlRoomSummaryGridClient.tsx`, `ExcavatorActivityTelemetryOverview.tsx`, and `MachineOperationsKpiStrip.tsx`.
  - Extracted `getErrorTitle`, `getErrorMessage`, and `getActionLink` into `apps/portal/lib/errors/error-display.ts` across `ErrorFallback.tsx`, `app/error.tsx`, `app/hub/error.tsx`, and `app/(departments)/[department]/error.tsx`.
  - Extracted `DepartmentPageLoadingSkeleton` into `apps/portal/components/skeletons/DepartmentPageLoadingSkeleton.tsx` across 5 department `loading.tsx` routes.
  - Extracted `openDockedGoogleWindow` into `apps/portal/lib/google-workspace.ts` across `SplitWindowGoogleCalendarView.tsx` and `SplitWindowGoogleDocsView.tsx`.
- **Tier 3 — Client Hooks, Telemetry & Domain Utilities (`apps/portal`, `libs/shared`, `packages/utils`)**:
  - Re-exported `apps/portal/lib/observability/client-telemetry.ts` from `@repo/shared/hooks` SSoT; exposed `@repo/utils/hlc` subpath export and delegated `compareHlc` in `useOfflineQueue.ts`.
  - Extracted `isAdtOrDumpTruck`, `isExcavator`, `isDozer`, and `isDrill` into `apps/portal/lib/control-room/machine-utils.ts` across `machine-operator-scan/route.ts` and `C66MachineOperatorScanner.tsx`.
  - Created `useFormDraftPersistence<T>` in `libs/shared/hooks/src/useFormDraftPersistence.ts` and refactored `DailyLogForm.tsx`, `DozerRollForm.tsx`, and `ControlRoomChecklistWidget.tsx`.
- **Tier 4 — Shared Infrastructure Packages (`@repo/supabase`, `@repo/redis`)**:
  - Consolidated 6 Supabase URL/anon-key/cookie-option resolvers into `packages/supabase/src/config.ts` across `client.ts`, `middleware.ts`, `proxy.ts`, and `server.ts`.
  - Consolidated `unrefSleep` and `getCircuitGuardedRedisClient` into `packages/redis/src/internal-utils.ts` across `locks.ts`, `streams.ts`, `cache.ts`, and `invalidation.ts`.
- **Tier 5 — Build, Audit & Governance Scripts (`tools/`)**:
  - Extracted `getDirSize` (`tools/lib/fs-metrics.cjs`), `getFormattedDate`/`getNextLogNumber` (`tools/lib/versioned-log-dir.cjs`), and `stripSqlComments`/`listMigrationFiles` (`tools/lib/sql-migration-utils.cjs`) across 8 audit/ops/governance scripts.
- **Control Room `ShiftCloseoutForm`, `ScadaPanel` Totals Memoization & Turbopack Analysis Synchronization**:
  - Refactored `apps/portal/app/(departments)/control-room/components/ShiftCloseoutForm.tsx` to extract shared `SMR_INPUT_BASE` utility constants, named domain thresholds (`SHIFT_TARGET_HOURS = 12.0`, `MAX_ALLOCATED_HOURS = 12.5`), and a single-options-object `updateMachine({ machineId, field, allocationValue })` helper.
  - Merged PR #223 (`bolt-memoize-scada-panel-totals-13702220800461324242`) consolidating `ScadaPanel.tsx` summary totals (`totalExcavatorLoads`, `totalMachineLoads`, `totalVolumeBcm`) into a memoized single-pass loop with unit test assertions in `ControlRoomPanels.test.tsx`.
  - Integrated `analyze:turbopack` (`portal#analyze:turbopack`) into `package.json` and `turbo.json` and synchronized active local/remote branches onto `main`.
  - Updated `tools/scripts/prune-vercel-deployments.mjs` to dynamically resolve `orgId` from `.vercel/project.json` and protect in-progress Production builds, pruning 173 stale deployments and synchronizing `.agents/memory_base/index.json`.

---

## [2026-11-09T16:20:00+02:00] - Real-Layer Differential Telemetry Comparator, W3C Server-Timing & Redis Bridge Fix

- **Real-Layer Differential Benchmark (`tools/scripts/real-layer-benchmark.mjs`)**:
  - Added `pnpm perf:real-layer`, `pnpm perf:baseline`, and `pnpm perf:compare` executing 100-iteration zero-mock probes against Node 24 (`perf_hooks.monitorEventLoopDelay`, `performance.eventLoopUtilization`, `v8.getHeapStatistics`, `crypto.timingSafeEqual`) and live TCP Redis (`PING`, `SET+GET`, `XADD+XRANGE`, `SET NX PX + DEL`).
  - Uncovered and remediated a real-layer container bridge bottleneck in `infra/redis/redis.conf` (`bind 127.0.0.1` inside Docker container namespace was resetting host `127.0.0.1:6379` bridge connections and forcing remote fallback), reducing live 34-test Redis integration duration from **80.9s → 4.5s (18x faster / -94.4%)** and p95 Redis TCP `PING` to **< 0.9ms**.
- **Unified Prometheus Registry & W3C `Server-Timing` Headers**:
  - Merged `getMetrics()` from `apps/portal/lib/observability/metrics.ts` (including new `node_event_loop_utilization_ratio`, `node_event_loop_delay_ms`, and `node_v8_heap_used_bytes` gauges) into `GET /api/metrics`.
  - Added W3C `Server-Timing` headers to `/api/health`, `/api/metrics`, `/api/control-room/scada-status`, and `/api/control-room/shift-completeness`.

---

## [2026-11-09T14:50:00+02:00] - Control Room E2E Server Action & Redis Integration Suites, Visual Regression Baselines, Tracer Consolidation & Governance Cadence

- **Control Room Operational Workflow & Telemetry Enhancements**:
  - Unified `ControlRoomSubtabs.tsx` and `@repo/ui` `DepartmentLayout.tsx` (`dashboard-subtab-shift-closeout`) to expose `Shift Closeout` (`/control-room/shift-closeout`) across every Control Room route.
  - Embedded `ControlRoomChecklistWidget` inside `ShiftCompilationClient.tsx` (`?tab=closeout`) with URL query synchronization.
  - Connected `ScadaPanel.tsx` to `/api/control-room/scada-status` (`scada-connection-status-badge`) and added inline row quick-action links (`Update Dig`, `+ Loads`, `+ Delay`).
  - Added Pre-Closeout SMR Readiness Gate banner (`shift-closeout-readiness-banner`) in `ShiftCloseoutForm.tsx` backed by `/api/control-room/shift-completeness` and interactive machine focus pills.
  - Extracted shared `getFleetOpeningSmrSnapshot()` in `apps/portal/lib/control-room-fleet-smr.ts` across `shift-closeout`, `shift-compilation`, and `end-smr` routes; standardized `getCurrentShift()` in `shift-coverage/page.tsx`; resolved supervisor `department_id` in `apps/portal/lib/actions/shift-closeout.ts`.
- **Shift-Closeout End-to-End Server Action & Live Redis Integration Suites**:
  - Expanded `apps/portal/lib/actions/shift-closeout.test.ts` and `apps/portal/lib/shift-closeout.test.ts` with end-to-end Server Action tests covering unauthenticated rejection, Zod validation, Redis 5-req/min rate-limiting, 3-strike PIN lockout, Separation of Duties (`closedBy.id === approver.id`), and fallback `shift_status` persistence.
  - Expanded `apps/portal/test/integration/redis-primitives.integration.test.ts` with live Redis integration tests for Control Room 3-strike PIN lockout and `tryWithLock` concurrent closeout serialization; wired `pnpm test:redis:integration` into Gate 21 (`tools/audits/audit-observability-resilience.cjs`).
- **Control Room Visual Regression Baselines**:
  - Created `e2e/visual/control-room.visual.spec.ts` and committed 9 baseline PNG snapshots in `e2e/visual/__snapshots__/visual/control-room.visual.spec.ts-snapshots/` across `chromium`, `mobile-chrome`, and `tablet-chrome`.
- **Quarterly Verification (`pnpm agent:verify` + `pnpm policy:gen`) & Annual Tech Stack Assessment**:
  - Added `tools/scripts/node-governance-updater.mjs` and `docs/operations/node-runtime-auto-updater-and-tech-stack-assessment.md` automating Node.js 24 stabilization (`pnpm node:stabilize`, `pnpm node:auto-update`), quarterly policy/gate verification (`pnpm governance:quarterly`), and annual tech stack assessment (`pnpm governance:annual-assessment`) while enforcing zero circular dependencies (`pnpm cycles`) and zero dead code (`pnpm knip`).
  - Evaluated 8 upstream Node.js ecosystems: adopted `nodejs/node`, `nvm-sh/nvm`, `pnpm/pnpm`, and `sindresorhus/awesome-nodejs`; scoped `websockets/ws` to Node test harnesses; discarded `remy/nodemon` (superseded by native `node --watch`), `validatorjs/validator.js` (superseded by `@repo/contract` Zod 4), and `Unitech/pm2` (superseded by Vercel Fluid Compute & Docker Compose).

---

## [2026-11-09T12:15:00+02:00] - 13-Department Automated Test Runner & Token Distribution Optimization

- **Department Test Runner (`tools/scripts/test-departments.mjs`)**: Added `pnpm test:departments` and `pnpm test:dept:<slug>` verifying all 13 operational departments (`106` suites, `782` tests) and `@repo/contract` schemas.
- **Token Distribution & Context Optimization**: Pruned duplicate skill archives and compacted oversized rules, reducing pre-task static context overhead by 43.3% (`6,419` tokens vs `25,000` ceiling).

---

## [2026-11-06T23:11:00+02:00] - Permanent Engineering Rules, Canonical 8-Step Server Actions & Tier-1 Login

- **Server Action Security Sequence (`apps/portal`)**: Enforced the Canonical 8-Step Security Sequence (`Authenticate -> Authorize -> Validate -> Rate-limit -> Execute -> Audit -> Invalidate cache -> Return`) across all portal Server Actions (`shift-closeout.ts`, `auth.ts`, `admin-users.ts`, `access-cards.ts`, `drilling.ts`, `excavator.ts`, `hourly-loads.ts`).
- **API & Scrape Authentication Hardening**: Added Zod query/payload schemas and timing-safe Bearer token validation on `/api/metrics` and `/api/telemetry/*`; registered React 19 `experimental_taintUniqueValue` on server-only keys.
- **Tier-1 Industrial Command Portal Login (`apps/portal` & `libs/features/auth/ui`)**: Unified dark obsidian glassmorphic `LoginForm` with `arch-systems-gold-separator` and deterministic Playwright visual baselines.

---

## [2026-11-05T12:55:00+02:00] - Monorepo Optimization Suite (`optimization.md` Sections 1–27)

- **Toolchain & Build (`root`, `tools`)**: Standardized Biome 2.x (`useSortedClasses`), Turborepo 2.x task graph caching, and task-scaled token budgeting (`tools/scripts/token-tracker.cjs`).
- **Strict Type Safety (`packages/*`, `libs/*`)**: Eliminated all `any` types across `@repo/utils`, `@repo/rate-limiter`, `@repo/errors`, and `libs/shared/data-access`.

---

## Consolidated Domain & Package History

### 1. Application Layer (`apps/portal`)

| Period            | Milestone Summary                                                                                                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11           | Next.js 16 App Router (`proxy.ts` + `server/proxy.ts` CSP nonce & RBAC), React 19 RSC streaming, Dual-Tier Cache (`cachedRSC` + Redis L1/L2 scoped tags), Control Room SCADA & Shift Closeout workflows.                                 |
| 2026-10           | Department dashboards (`drilling`, `production`, `access-control`, `engineering`, `plant-processing`, `plant-inventory`, `availability-utilization`, `overview`, `database`, `executive`), offline mutation queue with IndexedDB replay. |
| 2026-08 – 2026-09 | Translucent liquid-glass department panels, UniverSheet lazy chunk splitting, EXPLAIN ANALYZE query plan optimization.                                                                                                                   |

### 2. Shared Packages (`packages/*`)

| Package                   | Consolidated Historical Milestones                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/agents`            | STM-0 5-Phase Metacognitive Phase-Gate Evaluator (`QualityGate`), A2A swarm coordinator, token budget allocator, and harness engine verification.                                                               |
| `@repo/contract`          | Canonical Zod 4 schemas (`control-room`, `access-control`, `drilling`, `production`, `engineering`, `feature-flags`, `scada`) with zero contract drift (`pnpm audit:drift`).                                    |
| `@repo/database`          | 217 immutable SQL migrations (`packages/database/migrations/`), RLS `(SELECT auth.uid())` InitPlan optimization across all tables, composite operational shift indexes, and rollback safety verifiers.          |
| `@repo/errors`            | Canonical `AppError` hierarchy (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `DatabaseError`) with Next.js error boundary `digest` support.            |
| `@repo/eval`              | Gemini-first LLM judge routing and TDAD evaluation harness.                                                                                                                                                     |
| `@repo/logger`            | Structured Pino logging across server, browser, and Next.js runtime contexts with sensitive-field redaction.                                                                                                    |
| `@repo/rate-limiter`      | Atomic `FixedWindowStrategy` and `TokenBucketStrategy` backed by `RedisStore` and `MemoryStore` fallback.                                                                                                       |
| `@repo/redis`             | TCP & HTTP REST dual-protocol adapter, `sendSafe`/`detectCapabilities` resilience, `incrWithExpire`, `readKeyCounter`, `tryWithLock` distributed locking, and capped SCADA telemetry streams (`MAXLEN`).        |
| `@repo/supabase`          | Typed SSR & browser Supabase clients, Kysely query builder integration, and zero-leak credential isolation.                                                                                                     |
| `@repo/theme`             | OKLCH semantic design tokens, Style Dictionary codegen (`generated.ts`, `variables-generated.css`), light-mode `#f3f4f6` canvas invariant, and `gold-steel-border` hover/focus shimmer.                         |
| `@repo/typescript-config` | Strict NodeNext TypeScript 5.9 base configuration (`strict`, `noUncheckedIndexedAccess`).                                                                                                                       |
| `@repo/ui`                | Light-mode `GlassCard` variants (`default`, `window`, `spotlight`, `glowborder`, `liquid`), `DepartmentLayout` with collapsible sidebar & Control Room subtabs, `HeroRotator`, and Storybook axe a11y coverage. |
| `@repo/utils`             | Turbopack ESM-compatible Excel utilities and 3D borehole collar-to-toe vector projection math.                                                                                                                  |

### 3. Feature & Shared Libraries (`libs/*`)

| Library                        | Consolidated Historical Milestones                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/features/auth/ui`        | Tier-1 industrial `LoginForm`, password reset flows, and workspace dependency boundaries.                                                           |
| `libs/features/departments/ui` | `ControlRoomChecklistWidget`, `DozerRollForm`, shift closeout modals, and breakdown reporting components.                                           |
| `libs/features/hub/ui`         | `HeroRotator` WebP posters, hover-driven department prefetching, `DepartmentCard` loading overlays, and `DepartmentReviews` telemetry footer strip. |
| `libs/shared/data-access`      | Universal edge telemetry circuit breaker, weather API client, and strict TypeScript server action wrappers.                                         |
| `libs/shared/hooks`            | `useSupabaseRealtime` CDC subscriptions, `useClientCache`, `useOfflineQueue`, and accessibility-aware `IntersectionObserver` scroll reveal hooks.   |

### 4. Quality Gates, E2E & Tooling (`tools/`, `e2e/`, `scripts/`)

| Area       | Consolidated Historical Milestones                                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/`   | 27-Gate Enterprise Verification Suite (`tools/scripts/agent-verify.sh`), `policy-compiler.cjs` boundary enforcement, Zero-Drift Watchdog, and Antidrift Guardian (`antidrift-test.cjs`).      |
| `e2e/`     | Playwright multi-viewport suite (`chromium`, `mobile-chrome`, `tablet-chrome`), Galen Relational Spatial Layout Engine (`galen-layout.ts`), Control Room SCADA & visual regression baselines. |
| `scripts/` | `dev-system-reimagined.sh`, operational department seed generators (`ControlRoom@plantcormining.co.za`), and Vercel preflight/deployment automation.                                          |
