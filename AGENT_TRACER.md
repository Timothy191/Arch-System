# Arch-System Consolidated Agent Tracer Ledger (`AGENT_TRACER.md`)

> **Single Source of Truth (SSoT)**: Consolidated from 24 distributed `AGENT_TRACER.md` files (`root`, `apps/portal`, `packages/*`, `libs/*`, `tools`, `e2e`, `scripts`, `docs/archive`) to eliminate context fragmentation and enforce a single immutable audit ledger across the monorepo.

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
