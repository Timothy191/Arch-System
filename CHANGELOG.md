# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-11-17

### Added

- **Native Observability & CI Console (`/admin/observability` & `/overview`)**: Added `@repo/contract` Zod 4 observability schemas (`observability-layer.schema.ts`), dual-mode BFF endpoints (`/api/observability/summary` and `/api/observability/ci`), `ObservabilityConsole` component, and Docker Compose observability stack (`infra/docker/compose.observability.yml` with OpenTelemetry Collector, Prometheus, light-mode Grafana, and optional Woodpecker CI runner).
- **Autonomous Local CI Gatekeeper (`tools/scripts/autonomous-ci-gatekeeper.mjs` / `pnpm ci:gatekeeper`)**: Verifies candidate commits across the 28-gate `agent-verify.sh` suite and publishes all 6 required GitHub ruleset status contexts (`Quality Gates (Lint, Type Check, Build & Test)`, `Policy Check`, `Dead Code Detection`, `Dependency Lint`, `Security Audit`, `Tier 2 Review Policy Check`).
- **GitHub Wiki Audit & Synchronization (`pnpm audit:wiki` & `pnpm wiki:sync`)**: Added `tools/scripts/sync-github-wiki.mjs` to validate frontmatter, wikilinks, and index coverage and synchronize `docs/wiki/*` (`Home.md`, `_Sidebar.md`, `_Footer.md`, entities, concepts, comparisons, queries) directly to `Timothy191/Arch-System.wiki.git`.
- **VibeMon Multi-Agent Telemetry (`@repo/utils/vibemon`, `/api/health/vibemon`)**: Integrated VibeMon `v32` project-root wrapper (`./vibemon.sh`), Zod 4 schemas (`vibemon.schema.ts`), MCP registration, and live `AgenticMonitor` pulse telemetry.
- **CodeGraph & Graphify Knowledge Graph Substrate**: Added multi-language AST/graph indexing (`.ts`, `.tsx`, `.sql`, `.css`, `.tf`), `graphify` skill, and automated substrate freshness gates (`pnpm audit:code-intelligence`).
- **GitHub Codespaces Foundation (`.devcontainer/`)**: Added `.devcontainer/devcontainer.json` and `post-create.sh` provisioning Node.js 24, pnpm 9.15.9, Rust 1.85.0, Python 3.12, and local Redis 7.4.
- **Canonical Metallic Gold Token (`--accent-gold` / `#d4af37`)**: Added `accent-gold` and `accent-gold-hover` (`#c5a017`) to `@repo/theme` (`tokens.json`, `variables.css`, Tailwind preset) and unified `<Logo />`, menubar, system tray, Support widget, and `/hub` badges/separators to `rgb(212, 175, 55)`.

### Changed

- **Next.js 16.4.6 & Supply-Chain Hardening**: Upgraded `next` to `16.4.6` (`experimental.agentUpgrade: 'security'`), remediated all 7 Dependabot alerts (`hono >= 4.13.19`, `@hono/node-server >= 2.1.8`, `http2-wrapper >= 2.2.4`, `webpack-sources >= 3.7.0`), consolidated GitHub branch protection into a single `main-branch-protection` ruleset (`26682077`), and modernized `.github/dependabot.yml`, `CODEOWNERS`, `SECURITY.md`, and issue/PR templates.
- **Control Room Performance (`ExcavatorActivityList`)**: Memoized list rows and consolidated multi-metric rollups into a single $O(N)$ pass.

### Fixed

- **Supabase Realtime StrictMode Channel Collision (`useSupabaseRealtime`)**: Added monotonic channel sequence counter (`nextChannelSequence`) to prevent `Date.now()` channel collisions during React 19 StrictMode double-mounts.
- **Access Control Type & Runtime Hardening (`/access-control`)**: Restored rate-limiting (`GATE_PULSE_LIMITER`, `GATE_DENIAL_LIMITER`), operator attribution, and `noUncheckedIndexedAccess` safety across gate, muster, and report Server Actions.

## [1.6.2] - 2026-10-29

### Added

- **Control Room — 3-Step Guided Quick Delay & Shift SMR Logger (`/control-room/engineering-notes`)**: Added `QuickDelayLoggerPanel` above the 20-column Fleet Overview Ledger (`EngineeringOverviewTable`) with Step 1 (Machine, Start/Stop SMR & Operator with live `12.0h` shift cap), Step 2 (Color-coded Production, Natural & Other, and Engineering delay categories with one-tap duration chips `0h`–`6.0h`), and Step 3 (Mandatory delay comment with one-tap templates and direct row save), plus a Fleet Search & Machine-Type Filter Bar and `Simplified Table` view toggle.
- **Automatic End-of-Shift Breakdown Carry-Over (`/control-room/engineering-notes` & `/control-room/machine-operations`)**: Machines ending a shift on breakdown (`Ends shift on breakdown (carry over)` or `operational_status = 'BREAKDOWN'`) automatically carry over into the next shift (`day` -> `night` on the same date; `night` -> `day` on the next calendar date) via `computeNextShiftSlot` and `buildCarryOverBreakdownDelays`, locking opening and closing SMR to the prior Stop SMR and reconciling `12.0h` breakdown hours against the `12.0h` shift cap until booked out (`Book Out`).
- **Control Room — Dozer Activity Type Selection (`/control-room/machine-operations`)**: Added a dedicated `Dozer Activity Type` section (`Roll Over` vs `Other` checkboxes) in `MachineOperationsForm` when a Dozer is selected. `Roll Over` computes overburden rehabilitation volume at `250 BCM/h` and syncs to `dozer_rollover_logs`; `Other` provides quick-select activity presets (`Road / Ramp Maintenance`, `Stockpile Push`, `Floor / Pad Cleanup`, `Berm Construction`) with `0 BCM` roll-over.
- **Plant & Processing — Expanded Coal Seam & Material Options (`/plant-processing/hourly-sheet`)**: Added `4#Lower`, `2#Lower`, `2#Upper`, and `5#Seam` to `PLANT_SEAM_OPTIONS` across `Circuit & Unit Material` (`select#circuit-unit-header-material`), `Feed Seam Blend`, and per-stream material selectors in `PlantHourlyMatrixSection`.

### Changed

- **Control Room — Instant Excavator Material Toggle (`/control-room/excavator-activity`)**: Eliminated toggle latency on `Waste / Coal` switches via synchronous optimistic state updates (`upsertOptimisticActivity`, `pendingMutationCountRef`) and parallelized `Promise.all` Supabase mutations.
- **Control Room — Single-Pass Horizon Metric Aggregation (`AlertPanel`, PR #194)**: Replaced multi-pass `.filter()` and `.reduce()` chains across `shift`, `daily`, and `monthly` horizons with a single $O(N)$ accumulator pass (`RawAccumulator`, `accumulateLoad`, `finalizeMetrics`).
- **Authentication & Department Sidebar UI (`/login`, `DepartmentLayout`)**: Upgraded login card, sign-in button, overlapping brand logo badge, and department navigation sidebar with `liquid-glass-light` and `gold-steel-border` styling.

## [1.5.1] - 2026-06-24

### Changed

- Major cleanup: removed experimental AI features, implemented lazy loading, and restructured routes for improved load times.
- Optimized Core Web Vitals (LCP, CLS, INP) across portal interfaces.
- Added pagination to the access control admin dashboards to handle large datasets.
- Enhanced production readiness by applying high-priority security fixes and cleaning up development infrastructure.
- Resolved styling issue where solid body backgrounds hid negative z-index video/animation layers.

### Added

- Root TypeScript configuration for workspace-wide type enforcement.
- Security-only Dependabot configuration.
- Lighthouse CI performance budgets and mobile emulation testing configuration.
- Dynamic health check endpoint checking Supabase database and Redis cache connectivity.
- Webpack performance budgets in Next.js config for package size control.

## [1.5.0] - 2026-06-18

### Added

- Automated Zod schema generation and deep contract validation for cross-service API parity.
- Static OpenAPI spec generation for offline contract validation.
- Self-hosted Nx caching using `nx-remotecache-s3`.
- Adopted `nrwl/nx-set-shas` and affected commands in CI workflows for faster pipeline execution.
- Inline architecture comments (`// AGENT-TRACE:`) for automated agents.

### Fixed

- Fixed systemd service file destination path typo from `/etc/infra/systemd/system/` to `/etc/systemd/system/`.

## [1.4.0] - 2026-06-15

### Added

- Reorganized project structure for production readiness:
  - Moved runtime files to `run/` directory.
  - Organized config files into `config/`, `docs/`, and `docker/` subdirectories.
  - Setup ESLint boundary rules and syncpack configs.
- Integrated `sync-assets-smart` to optimize build-time asset synchronization.
- Implemented static Row Level Security (RLS) policies auditor tool.

## [1.0.0] - 2026-06-15

### Added

- Initial release of the Arch-System Mining Operations Portal.
- Monorepo structure with Turborepo, pnpm workspaces, and Nx.
- Supabase integration with database migrations and schema types.
- Shared `@repo/ui` Radix/shadcn design system package.
