# Arch-System Consolidated Agent Tracer Ledger (`AGENT_TRACER.md`)

> **Single Source of Truth (SSoT)**: Consolidated from 24 distributed `AGENT_TRACER.md` files (`root`, `apps/portal`, `packages/*`, `libs/*`, `tools`, `e2e`, `scripts`, `docs/archive`) to eliminate context fragmentation and enforce a single immutable audit ledger across the monorepo.

---

## [2026-11-10T11:30:00+02:00] - Monorepo Tooling Optimization, Knip Duplicate Elimination & Pipeline Hardening

- **Knip Duplicate Export Remediation**:
  - Eliminated duplicate named + default export in `apps/portal/app/(departments)/[department]/machine-operations/MachineOperationsFilterableTable.tsx` by removing redundant `export default`.
  - Updated `apps/portal/app/(departments)/[department]/machine-operations/page.tsx` dynamic import from `.then((m) => m.default)` to `.then((m) => m.MachineOperationsFilterableTable)`.
  - Updated `apps/portal/app/(departments)/[department]/machine-operations/MachineOperationsList.test.tsx` to use named import `{ MachineOperationsFilterableTable }` (`21/21` tests passing; `pnpm knip` reporting zero issues).
- **Turborepo & Package Pipeline Alignment (`turbo.json`)**:
  - Defined explicit `"lint:ci"` task in `turbo.json` with cached inputs (`$TURBO_DEFAULT$`, `!README.md`, `!**/*AGENT_TRACER.md`, `!**/codemap.md`, `$TURBO_ROOT$/biome.json`, `.eslintrc.*`).
  - Added `"lint:ci": "biome ci ."` across `apps/portal`, `@repo/agents`, `@repo/contract`, `@repo/errors`, `@repo/logger`, `@repo/rate-limiter`, `@repo/redis`, `@repo/supabase`, `@repo/theme`, `@repo/ui`, `@repo/utils` (`12/12` packages pass `pnpm turbo run lint:ci`).
- **Dynamic Verification Suite Sizing (Gate 24/27)**:
  - Updated `tools/audits/verify-27-gates.cjs` to dynamically count `run_gate` invocations in `tools/scripts/agent-verify.sh` rather than checking against a brittle hardcoded number, keeping the evidence manifest validation honest as gates expand.
  - Documented the 28-Gate enterprise suite architecture in `agent-verify.sh`.
- **Token Budget Threshold Calibration & CI Preflight (Gate 22)**:
  - Aligned `@repo/agents` compaction thresholds (`COMPACTION_SOFT_THRESHOLD = 0.8`, `COMPACTION_CRITICAL_THRESHOLD = 0.92`) and ensured `warningTriggered = true` is reported on breach when `enforceHardCap` is disabled (`52/52` tests passing).
  - Wired Gate 22 (`tools/scripts/vercel-preflight.cjs --env=ci`) into `.github/workflows/deploy.yml` and `ga.yml` before staging and production deployments.
  - Added `ENOSPC` and `inotify` to `config/tools/cspell.json`.
- **Verification Completion**: Full 28-gate suite (`pnpm agent:verify`) passed with 100% compliance.

---

## [2026-11-10T10:16:00+02:00] - Two-Stage Compaction Engine (`/compact` vs `/compact/compact`), Bounded `SKILL.state` Spine & Double-Compaction Prefix Cache Guard

- **EARS Spec (`docs/specs/compaction-strategy-improvements.spec.md`)**: Authored formal specification grounded in empirical telemetry across `1,245` model generations (`9.12M` uncached input tokens, `165.48M` cached read tokens, `94.77%` cache hit ratio) and `13` compaction checkpoints in `~/.gemini/antigravity-cli/conversations/999d8f18-0f73-4df3-9fbc-c385c3a91ba6.db`.
- **`@repo/agents` Compaction Primitives (`packages/agents/src/token-budget.ts` & `token-budget.test.ts`)**:
  - Added `PROACTIVE_HANDOFF_THRESHOLD = 0.7`, `COMPACTION_IDEMPOTENT_FLOOR = 0.25`, `MIN_TURNS_BETWEEN_COMPACTIONS = 4`, and `MAX_COMPACTION_STATE_CHARS = 4000`.
  - Upgraded `assessContextCompaction` to emit `shouldPrepareHandoff` and `'prepare_handoff'` at `70%` context utilization before hitting the `85%` soft compaction cliff.
  - Added `evaluateDoubleCompactionGuard` to prevent redundant LLM prefix cache invalidation on `/compact/compact` or when context fill is `< 25%` (`consolidate_state_spine`).
  - Added `applyCompactionStatePatch` enforcing a Google/Purdue `SKILL.state` bounded O(1) JSON state spine (`<= 4,000` chars, `null` key deletion).
  - Added `extractRareNeedlesFromLog` implementing IDF rare-needle (`df <= 2`) and error-line preservation across middle log windows (`14/14` unit tests passing).
- **Two-Stage Compaction CLI (`tools/scripts/compact-context.cjs`, `pnpm compact`, `pnpm compact:deep`)**:
  - Created `tools/scripts/compact-context.cjs` reading live `ag-v1` SQLite + JSONL telemetry, extracting the 6-Section Artifact Trail (`Created`, `Modified`, `Inspected [DO NOT RE-READ]`, `Verification Ledger`, `Bounded SKILL.state`), and atomically writing `.handoff/handoff.{md,json}`, `<artifactDir>/HANDOFF.md`, `.remember/now.md`, and `.agents/memory_base/retrospectives/compaction-<id>.json`.
  - Wired `pnpm compact` (`--mode standard`) and `pnpm compact:deep` (`--mode deep`, executing `retrospective-cleanup.cjs --remove-duplicates`, `smart-indexer.cjs`, and log pruning).
- **`slim-tooling-mcp` & Antigravity Hook Bridge**:
  - Upgraded `TokenSavingEngine.truncateWindow` and added `transcript_compact` strategy in `slim-tooling-mcp/src/token-saving-engine.ts` and `src/index.ts` (`4/4` tests passing).
  - Upgraded `/home/tim/.gemini/config/plugins/token-optimizer/antigravity_hook_bridge.py` (`pre-invocation` and `stop`) and `.agents/hooks/pre-invocation-inject.sh` to automatically persist and re-inject the compact `SKILL.state` spine across `/compact` and `/compact/compact` events.

---

## [2026-11-10T08:15:00+02:00] - Monorepo Lexical, Spelling, Grammar & File-Naming Governance (`AGENT_TRACER.md` SSoT)

- **EARS Spec (`docs/specs/lexical-and-naming-governance.spec.md`)**: Authored formal specification establishing unified American English (`en-US`) spelling, grammar, identifier, and file-naming enforcement across all agents, hooks, pre-commit checks, and CI verification gates.
- **Canonical Root `AGENT_TRACER.md` Restoration**:
  - Renamed root ledger to canonical `AGENT_TRACER.md` via `git mv`, updated all references in `AGENTS.md`, `.agents/rules/execution-guardrails.md`, `.agents/rules/general-best-practices.md`, `apps/portal/next.config.mjs`, `tools/audits/audit-agentic-content.cjs`, `tools/audits/antidrift-test.cjs`, `tools/scripts/real-layer-benchmark.mjs`, `tools/scripts/token-tracker.cjs`, and `documentation/03-audit-reports/agentic-audit-report.md`.
  - Removed the `"**/AGENT_TRACER*.md"` exclusion blind spot from `config/tools/cspell.json` so `AGENT_TRACER.md` is continuously spell-checked on every edit and gate run.
- **4-Layer Forced Lexical & Naming Governance**:
  - **Layer 1 (Expanded `pnpm lint:spelling`)**: Expanded `package.json` `lint:spelling` to audit `1,926` files across `*.md`, `.agents/**/*.md`, `.github/**/*.md`, `apps/`, `packages/`, `libs/`, `docs/`, `tools/`, and `scripts/` with `0` issues; fixed the `importSpecifiers` identifier typo in `tools/scripts/generate-codemaps.mjs`.
  - **Layer 2 (Always-Apply Agent Rule)**: Created `.agents/rules/lexical-and-naming-governance.md` (`alwaysApply: true`) and symlinked `../.agents/rules/lexical-and-naming-governance.md` (`32/32` workspace rules synced in Gate 9).
  - **Layer 3 (PostToolUse & Pre-Commit Hooks)**: Updated `.qoder/hooks/auto-format.sh` and `.lintstagedrc.mjs` to run Biome, Markdownlint, Prettier, and `cspell` automatically on modified/staged files.
  - **Layer 4 (PreToolUse Path Guard & Gate 25 Probes)**: Updated `.qoder/hooks/protect-paths.sh` and `tools/audits/audit-agent-permissions.cjs` (11 synthetic probes) to block creation of misspelled root tracer files or nested `*/AGENT_TRACER.md` files with exit code `2`.

---

## [2026-11-10T07:16:00+02:00] - SSoT Duplicate Regression Guard, Shared `DepartmentFilterToolbar` & Control Room `Server-Timing` Telemetry

- **EARS Spec (`docs/specs/next-steps-ssot-toolbar-telemetry.spec.md`)**: Authored specification for automated SSoT duplicate-declaration prevention, shared `@repo/ui` department filter toolbar, and live W3C `Server-Timing` badge integration in Control Room SCADA telemetry.
- **Step 1 — Automated Duplicate-Symbol Regression Guard (`tools/audits/audit-ssot-duplicates.cjs`)**:
  - Created `tools/audits/audit-ssot-duplicates.cjs` (`pnpm audit:ssot-duplicates`, wired into `pnpm audit:compliance` and Gate 9 of `tools/scripts/agent-verify.sh`) verifying across `1,032` source files that all `20` canonical SSoT functions, components, hooks, and constants are declared exclusively in their canonical modules (`0` duplicates).
- **Step 2 — Shared `DepartmentFilterToolbar` Primitive (`@repo/ui`)**:
  - Created `packages/ui/src/components/DepartmentFilterToolbar.tsx` (`@repo/ui/DepartmentFilterToolbar`), exported from `packages/ui/src/index.ts` and `packages/ui/package.json`, with unit test coverage in `apps/portal/components/ui/DepartmentFilterToolbar.test.tsx` (`apps/portal/jest.config.cjs`).
- **Step 3 — Live Control Room W3C `Server-Timing` Telemetry Strip**:
  - Created `apps/portal/lib/observability/server-timing-client.ts` (`parseServerTimingHeader`, `formatServerTimingSummary`) and `apps/portal/lib/observability/server-timing-client.test.ts`.
  - Updated `apps/portal/features/departments/components/control-room/ScadaPanel.tsx` and `ControlRoomPanels.test.tsx` to parse the `Server-Timing` HTTP response header from `/api/control-room/scada-status` and render `data-testid="scada-server-timing-badge"`.
- **Step 4 — Branch Triggers, GitHub Ruleset `#26682077` & CI Artifacts Standardization**:
  - Standardized `.github/workflows/ci.yml`, `deploy.yml`, `reviewdog.yml`, and `dast.yml` branch triggers to `branches: [main]`, removing nonexistent `master` and `staging` refs.
  - Upgraded `.github/workflows/scorecard.yml`, `test-report.yml`, and `theme-ci.yml` to `actions/upload-artifact@v6` (`b7c566a772e6b6bfb58ed0dc250532a479d7789f`) with `retention-days: 14`.
  - Synchronized GitHub Ruleset `#26682077` (`main-branch-protection`) and Classic Branch Protection required status checks (`Quality Gates (Lint, Type Check, Build & Test)`, `Policy Check`, `Dead Code Detection`, `Dependency Lint`, `Security Audit`, `Tier 2 Review Policy Check`) with live `.github/workflows/ci.yml` job names and enabled `delete_branch_on_merge: true`.

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

---

## 2026-11-10 — Code Intelligence: review, gap-fill, and evidence-based verification

**Agent:** main · **Scope:** `~/.agents/skills/code-intelligence/scripts/` + `/home/tim/local.db`

| #   | Action                                                                                                                                                                                                                     | Evidence                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Re-verified all four handoff claims with fresh runs (git status, DB counts, RRF, TDAD, chunking)                                                                                                                           | `git status --porcelain` → 0 untracked; DB → 8,982 entities / 46,000 relations / 779 files |
| 2   | Found real gap: `ast_chunker.py` has no TS AST path → `.ts/.tsx` falls through to regex fallback                                                                                                                           | `shift-closeout.ts` → 17 chunks, `empQuery` swallowed L114–195 (82 lines)                  |
| 3   | Found deeper root cause: TS indexer stored `end_line = start_line` for **8,769 of 8,982 entities (97.6%)**                                                                                                                 | `SELECT kind, COUNT(*) ... WHERE end_line=start_line`                                      |
| 4   | Built `ts_parse.cjs` + `ts_parse_dir.cjs` (node + TypeScript compiler API, repo-resolved `require`, script-kind from extension)                                                                                            | Batch parse: 1,365 files, 9,267 arrow functions                                            |
| 5   | Built `ts_ast_chunker.py` (real syntactic ranges; comment-inclusive chunk content)                                                                                                                                         | `shift-closeout.ts` → 8 chunks, max 30 lines                                               |
| 6   | Built `backfill_ranges.py` (2-pass: named `(file,name,start)` then anonymous `(file,kind,start)`)                                                                                                                          | 6,539 `end_line` updates; 8,769 → 2,230 no-range                                           |
| 7   | Fixed 3 parser bugs found during verification: (a) Python `"""` docstring in `.cjs`, (b) `getJSDocComments` → `node.jsDoc`, (c) `ScriptKind.TS` hardcoded → `.tsx` arrows silently dropped (8 vs 20 in `DailyLogForm.tsx`) | Verified against ground-truth line numbers via `grep`                                      |
| 8   | Applied to real index after backup; integrity check passes                                                                                                                                                                 | `/home/tim/local.db` 8,982 / 46,000 / 6,752 ranged; `PRAGMA integrity_check` → ok          |
| 9   | Repo stays git-clean; all new scripts live in the skill dir, outside the repo                                                                                                                                              | `git status --porcelain \| grep -c '^??'` → 0                                              |

**Result:** 6,752/8,982 entities (75.2%) now carry body ranges. Remaining 2,230 are single-line declarations (`const x = 1`, `postMessage() {}`) with no range to capture — not a defect.

**Key lesson:** the bundled chunker's regex fallback and the indexer's missing `end_line` were two symptoms of one root cause (no TS AST path). Fixing the parser surfaced the schema gap; fixing the schema made real chunking possible.

### [2026-11-10T09:02:00+02:00] Evidence-Based Gap Review & Remediation — Markdownlint, Naming Hygiene, `DepartmentFilterToolbar` Adoption & Local CI Parity

- **Phase 1 (Comprehension):** Conducted an empirical review of the monorepo across spelling/markdown governance, SSoT duplicate guards, department toolbar adoption, compliance audit idempotency, and CI/local-CI workflows.
- **Phase 2 (Evidence):** Identified 6 concrete gaps via executed tool outputs:
  - `pnpm md:lint` and `pnpm md:fix` in `package.json` omitted `--config config/tools/.markdownlint.json --ignore-path .gitignore`, causing ~10,900 false positives and 38 tracked `.md` formatting violations.
  - `audit-agentic-content.cjs` lacked recursive sub-package `*/AGENT_TRACER.md` and schema/type/migration file-naming checks, and was not wired into Gate 9.
  - `DepartmentFilterToolbar` (`@repo/ui/DepartmentFilterToolbar`) was not yet adopted in a department view per `docs/specs/next-steps-ssot-toolbar-telemetry.spec.md` Step 2.
  - `run-audit.cjs` lacked `--check` mode, causing `pnpm audit:compliance` to dirty `documentation/03-audit-reports/`.
  - `.github/workflows/ci.yml` pointed `GITLEAKS_CONFIG` at nonexistent `.gitleaks.toml` instead of `config/tools/.gitleaks.toml`, and `local-ci.mjs` left `rust-quality` and graph steps unmapped.
  - spec headers and session artifacts needed status synchronization.
- **Phase 3 (Design):** Added `--config config/tools/.markdownlint.json --ignore-path .gitignore` to `md:lint`/`md:fix`, remediated all 38 Markdown files, wired `pnpm md:lint` into Gate 2 and `audit-agentic-content.cjs --check` into Gate 9 of `agent-verify.sh`, adopted `DepartmentFilterToolbar` in `PlantHistoryDatabaseClient.tsx`, added `--check` mode to `run-audit.cjs`, and aligned `ci.yml` + `local-ci.mjs`.
- **Phase 4 (Criticism):** Added optional `searchAriaLabel` and `shiftAriaLabel` props to `DepartmentFilterToolbar` to preserve existing screen-reader labels and unit test queries in `PlantHistoryDatabaseClient.tsx`.
- **Phase 5 (Contract):** Verified `pnpm md:lint`, `pnpm lint:spelling`, `pnpm --filter portal test`, `pnpm audit:compliance`, `pnpm ci:local`, and 27/27 gates in `pnpm agent:verify`.

### [2026-11-10T09:28:00+02:00] Complete Forensic Gap Closure — Complexity Hotspot (`03-complexity-hotspot-refactor`), 100% Contract Drift Threshold, Auth Guard Hardening, Gate 11 Security Headers & Live AI Telemetry

- **Phase 1 (Comprehension):** Audited all remaining open items across `docs/specs/03-complexity-hotspot-refactor.md` (`Status: PARTIAL`) and the 27-Gate Forensic Report (`real_world_27_gates_audit.md`).
- **Phase 2 (Evidence):**
  - `docs/specs/03-complexity-hotspot-refactor.md` remained `PARTIAL` with `handleExcavatorMaterialChange` in `ExcavatorActivityForm.tsx` at cyclomatic complexity `15` (`> 8`).
  - Gate 5 (`tools/audits/audit-contract-drift.cjs:32`) set `DRIFT_HEALTHY_THRESHOLD = 80` despite 100% contract schema coverage across all 104 database tables.
  - Gate 16 (`tools/audits/audit-authorization-matrix.cjs:72`) included `/withRateLimit/` in `AUTH_GUARD_PATTERNS`, allowing rate-limiting alone to satisfy authentication checks, and `apps/portal/app/api/sync/fallback/route.ts` did not verify session authentication prior to claiming Redis idempotency keys.
  - Gate 11 (`tools/audits/audit-hooks-and-clients.cjs`) did not verify HTTP security headers in `apps/portal/proxy.ts` / `apps/portal/next.config.mjs` or scan `apps/portal/hooks`.
  - `e2e/accessibility.spec.ts` (`'should have sufficient color contrast'`) only checked element count (`expect(count).toBeGreaterThan(0)`).
  - `apps/portal/app/overview/sections/AgenticMonitor.tsx` ran a no-op `setTimeout` in `handleRefresh` without fetching `/api/ai/metrics`.
  - `version.json` and `apps/portal/lib/version.generated.ts` required synchronization via `pnpm version:sync`.
- **Phase 3 (Design):** Extracted `buildExcavatorMaterialTransition`, `applyExcavatorMaterialState`, `notifyRegularMachineMaterial`, and `adjustPendingMutationCount` in `ExcavatorActivityForm.tsx` (reducing `handleExcavatorMaterialChange` cyclomatic complexity to `3`); raised `DRIFT_HEALTHY_THRESHOLD` to `100`; added `getUserSafely(supabase)` session auth to `/api/sync/fallback` and removed `/withRateLimit/` from `AUTH_GUARD_PATTERNS`; added CSP/HSTS/security-header and `apps/portal/hooks` checks to `audit-hooks-and-clients.cjs`; added WCAG relative luminance contrast computation (`>= 4.5`) to `e2e/accessibility.spec.ts`; wired `AgenticMonitor.tsx` to `/api/ai/metrics`; and ran `pnpm version:sync`.
- **Phase 4 (Criticism):** Preserved fallback resilience in `AgenticMonitor.tsx` when offline or inside isolated unit tests, and enforced `<= 2` positional parameters on all extracted helpers in `ExcavatorActivityForm.tsx`.
- **Phase 5 (Contract):** Verified `pnpm lint:agent-rules`, `pnpm audit:compliance`, `pnpm agent:verify` (27/27 gates), fast-forward merge into `main`, and Vercel Production deployment.

### [2026-11-10T09:58:00+02:00] Code-Intelligence Substrate Enforcement Layer — Gate 28, Permanent Rule, Skill, and Memory-Base Prevention

- **Phase 1 (Comprehension):** Governing request: _"add rules, guardrails, and other to ensure this is applied/enforced by all other active agents."_ The CodeGraph index (TS AST parser + SQLite at `/home/tim/local.db`) was built and verified in the prior session but had zero enforcement — any agent could report structural results against a drifted index or a hand-edited DB. Resolved scope: enforcement must be (a) a machine gate in `agent-verify.sh`, (b) a permanent `alwaysApply` rule, (c) a discoverable skill, and (d) a memory-base prevention rule.
- **Phase 2 (Evidence):**
  - `tools/scripts/ci-snapshot.cjs` had a real `DB_PATH` bug: `path.resolve(ROOT, "..")` resolved to `/home/tim/Fork/local.db`, one level short of the actual `/home/tim/local.db`. `tools/audits/audit-code-intelligence-drift.cjs` already resolved correctly via `path.resolve(ROOT, "..", "..")`. Confirmed by running `node -e` path resolution against both scripts.
  - Live index verified: `entities: 8982`, `relations: 46000`, `files: 779`, `ranged: 6752`, `rangedRatio: 0.7517`, `noRangeRatio: 0.2483`.
  - Gate 28 already present in `agent-verify.sh` at line 171 (after gate 26, before manifest assembly); footer already dynamic (`${TOTAL_GATES}/${TOTAL_GATES}`).
  - `package.json` already had `audit:code-intelligence`, `ci:snapshot`, `ci:reindex` entries.
  - Rule-drift audit (`tools/audits/audit-agent-rules-drift.cjs`) confirmed 51 canonical rules, 32 symlinked, my new rule correctly classified as project-only (legal — no mirror copy created).
- **Phase 3 (Design):**
  - Fixed `ci-snapshot.cjs` `DB_PATH` to `path.resolve(ROOT, "..", ".."), "local.db"`.
  - Ran `pnpm ci:snapshot` → wrote `.agents/memory_base/index-snapshot.json` with the exact live counts.
  - Proved the gate can fail: (1) `CODEGRAPH_DB=/tmp/fake.db` → `❌ FAIL — index DB not found`, exit 1; (2) synthetic `/tmp/fake_drift.db` with 100 entities / 0 relations / 100% no-range → `❌ FAIL — 5 drift condition(s) detected`, exit 1. Both fake DBs deleted afterward.
  - Wrote `.agents/rules/code-intelligence-substrate.md` (alwaysApply, paths `**/*`): SSoT declaration, the three invariants (end_line ≥50% ranged / ≤45% no-range, counts must match snapshot, DB never hand-edited), the four canonical commands, tooling location contract, and the evidence contract.
  - Wrote `.agents/skills/code-intelligence/SKILL.md`: Step 0 verify → Step 1 refresh cycle → Step 2 hybrid RRF search → Step 3 TDAD impact → Step 4 AST chunking, with the evidence contract and failure mode.
  - Added memory-base prevention rule `prevention-20261110-code-intelligence-substrate` (category `TOOLING_GOVERNANCE`) to `.agents/memory_base/index.json`, raising `totalRetrospectives` to 15.
  - Updated `AGENTS.md`: completion gate 27→28 with the `code-intelligence` gate added to the range list; added `ci:reindex` / `ci:snapshot` / `audit:code-intelligence` to targeted commands; added a Code-Intelligence Substrate bullet to Runtime/Tooling Preferences; added the four new files to Important Files; updated the 27-gate references in Test conventions and Agent Action Scoring to 28.
- **Phase 4 (Criticism):** Verified gate 28 placement is safe (manifest assembly reads `${TMP_GATES_NDJSON}` which every `run_gate` appends to, so adding gate 28 before that step is fine; the dynamic footer protects against renumbering). Confirmed the `verify-27-gates.cjs` filename is a pre-existing artifact name — renaming it is out of scope and would break existing references. Confirmed `node:sqlite.DatabaseSync` read-only queries are safe against the WAL index; the gate never writes. Confirmed the new rule being project-only is legal per the rule-drift audit and that no mirror symlink was created.
- **Phase 5 (Contract):** Verified `node tools/audits/audit-code-intelligence-drift.cjs` → `✅ PASS`, exit 0, against the live index (8,982 / 46,000 / 779 / 75.2%). Verified both fail paths produce `❌ FAIL` and exit 1. Verified `.agents/memory_base/index.json` and `index-snapshot.json` parse as valid JSON. Verified `~/.agents/skills/code-intelligence/scripts/` is intact (ts_parse.cjs, ts_parse_dir.cjs, backfill_ranges.py, ts_ast_chunker.py, hybrid_rrf_search.py, tdad_impact_analyzer.py) and the repo contains only enforcement machinery. Verified `git status` shows 0 untracked files attributable to prior sessions; the 4 new untracked files and 4 modified files are this session's enforcement layer.

### [2026-11-10T08:13:45+00:00] Code-Intelligence Enforcement Machinery — Always-Applied Layers

- **Phase 1 (Comprehension):** Governing request: _"ensure the action or creation of the required to enforce the index is always applied."_ Gate 28 existed but only fired when an agent explicitly ran `pnpm agent:verify`. The request asks for machinery that makes the gate fire automatically on every agent action so the index-enforcement requirement is always applied by all active agents. Resolved scope: (a) edit-time hook firing on every `Edit|Write` via the existing `.qoder/hooks/` harness, (b) pre-commit hard-block preventing shipping of a disabled/bypassed enforcement layer, (c) pre-push gate running the full suite, and (d) protected-path rules blocking direct edits to the enforcement SSoT.
- **Phase 2 (Evidence):** Verified the live state before editing: `node tools/scripts/check-enforcement-integrity.cjs` → `✅ Enforcement SSoT integrity verified.`, EXIT=0 (drift audit passes, snapshot matches live index, edit-time hook registered, pre-push totalGates-aware). Confirmed `.agents/skills/code-intelligence/SKILL.md` and `AGENTS.md` lacked any enforcement-machinery section, and `package.json` had no `audit:enforcement` script.
- **Phase 3 (Design):**
  - Added `"audit:enforcement": "node tools/scripts/check-enforcement-integrity.cjs"` to `package.json` scripts (after `audit:code-intelligence`).
  - Extended the Code-Intelligence Substrate bullet in `AGENTS.md` (Runtime/Tooling Preferences) with the always-applied enforcement layer description and the `pnpm audit:enforcement` reference.
  - Added an "Enforcement machinery (do not disable)" section to `.agents/skills/code-intelligence/SKILL.md` mirroring the rule file's 4-layer table (edit-time hook, pre-commit guard, protected paths, pre-push gate) plus the SSoT file list and the self-check command.
  - Appended the ISO-8601 entry to root `AGENT_TRACER.md` (single consolidated ledger; no per-package tracer created).
- **Phase 4 (Criticism):** Confirmed the edit-time hook remains non-blocking by design (a stale index must not freeze legitimate feature work — the hard block is at pre-commit). Confirmed `check-enforcement-integrity.cjs` runs `execSync` on the audit script with `stdio: "pipe"` and a 60s timeout, so it cannot hang or leak output. Confirmed the `verify-27-gates.cjs` filename is a pre-existing artifact name and was not touched. Confirmed no new files were created outside the enforcement SSoT set.
- **Phase 5 (Contract):** Re-ran `node tools/scripts/check-enforcement-integrity.cjs` → `✅ Enforcement SSoT integrity verified.`, EXIT=0. Ran `git status` — 0 untracked files attributable to prior sessions; this session's changes are confined to the enforcement SSoT files (`package.json`, `AGENTS.md`, `.agents/skills/code-intelligence/SKILL.md`, `AGENT_TRACER.md`) plus the pre-existing modifications from earlier turns.

### [2026-11-10T08:54:17+00:00] Evidence-Based Gap Review & Remediation — Production Blockers, CI/Agent-Verify Drift, and Doc Hygiene

- **Phase 1 (Comprehension):** Governing request: _"Scan for untracked content and determine actions so we can move on / Review and fill gaps use evidence-based workflow."_ Five parallel explore agents audited MCP wiring, the 28-gate suite, enforcement machinery, CI/deploy wiring, and codebase health. The enforcement-machinery docs work from the 08:13 entry was already complete; this entry covers the gaps the agents found and the fixes applied.
- **Phase 2 (Evidence):**
  - **MCP wiring**: `codemap` MCP server alive but boots in watch-only mode (`ENOSPC` on inotify instances); `chrome-devtools-mcp` pinned at 1.10.1 (latest 1.12.0); `ast-grep`/`sg` shim exists but no version installed; `global-toolchain.md` rule referenced by `SYSTEMS.md` does not exist.
  - **Gate suite**: evidence JSON + JUnit were **stale** — recorded 27 gates with `gitTreeHash` `73f991d` while the working tree was `a1d35ae`; gate 28 was added after the last run. `turbo.json` had no `lint:ci` task despite gate 2 referencing `pnpm turbo run //#lint:ci`. `verify-27-gates.cjs:64` hardcoded a magic `23` minimum-gate floor.
  - **Enforcement machinery**: `check-enforcement-integrity.cjs` (4 checks) proven to fail under all 4 injected faults in a sandbox; hook wiring, protected paths, pre-commit, and pre-push all correct.
  - **CI/deploy**: 15 of 28 gates have no CI coverage; `vercel-preflight.cjs` unmapped in `local-ci.mjs LOCAL_STEPS`; all four Vercel deploy scripts orphaned from CI; no `full`-suite `local-ci` report exists.
  - **Codebase health**: `recordUsage` left `warningTriggered=false` while `breached=true` when `enforceHardCap=false`; spec REQ-1 mandated soft 80% / critical 92% but code had 0.85 / 0.95; retrospective `compaction-999d8f18.json` had non-canonical `status: "success"`.
- **Phase 3 (Design):**
  - Fixed `recordUsage` to always set `warningTriggered=true` on overrun, and added a regression test for `enforceHardCap: false` (15/15 pass).
  - Aligned `COMPACTION_SOFT_THRESHOLD` to `0.8` and `COMPACTION_CRITICAL_THRESHOLD` to `0.92`, and added an 84% soft-compaction assertion that distinguishes the new thresholds from the old ones.
  - Removed the non-canonical `status` field from `compaction-999d8f18.json` (schema has no `status` property; nothing consumes it).
  - Updated `agent-verify.sh` header/banner/stage comment from 27→28 gates with an explicit numbering note for gates 24/27.
  - Replaced the magic `23` floor in `verify-27-gates.cjs` with a dynamic count of `run_gate` invocations in `agent-verify.sh`.
  - Added `lint:ci` to `turbo.json` and to all 11 package `package.json` files (root `lint` already delegated via `//#lint:ci`).
  - Added `vercel-preflight.cjs` to `local-ci.mjs LOCAL_STEPS` (`quality :: Build, Deployment & Rollback Verification`) and wired it into `ga.yml` and `deploy.yml`.
  - Fixed `SYSTEMS.md` doc drift: removed the dangling `global-toolchain.md` reference, corrected `difftastic` → `difft`, noted `ast-grep`/`sg` availability is verified by gates 7 and 28.
  - Aligned `GUIDE.md`: Jest thresholds 30/30 → 27/28, and 27-gate → 28-gate in two places.
- **Phase 4 (Criticism):** Gate 2 failed on first `agent-verify` run — Biome flagged `0.80` → `0.8` and a duplicate `resolution` key in the retrospective (the schema already required `resolution`, so my edit duplicated it). Both fixed; `pnpm turbo run //#lint:ci` now passes clean. Re-ran the full suite: **28/28 gates PASS**, `gitTreeHash` `b738c23b…` matches the working tree exactly.
- **Phase 5 (Contract):** Verified `node tools/scripts/check-enforcement-integrity.cjs` → EXIT=0. Verified `pnpm turbo run //#lint:ci` → 1 successful task. Verified `.agents/memory_base/retrospectives/compaction-999d8f18.json` and all edited JSON files parse. Verified `git status` shows 0 untracked files; all 21 modified files are this session's gap-remediation work.
