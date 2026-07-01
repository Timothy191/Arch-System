# Wiki Log

> Chronological record of all wiki actions. Append-only.
> Format: `## [YYYY-MM-DD] action | subject`
> Actions: ingest, update, query, lint, create, archive, delete
> When this file exceeds 500 entries, rotate: rename to log-YYYY.md, start fresh.

## [2026-05-14] create | Wiki initialized

- Domain: Company knowledge base for Arch-Systems (Plantcor)
- Path: /home/timothy/Project/Arch-Mk2/wiki
- Structure created with SCHEMA.md, index.md, log.md, and raw/ subdirectories
- Tag taxonomy defined: Teams & People, Systems & Products, Processes & Workflows, Projects & Initiatives, Concepts & Architecture, Decisions & Policies, Issues & Incidents, External, Meta

## [2026-05-15] ingest | Codebase source batch

- Ingested 7 raw sources from codebase analysis:
  - raw/codebase/migrations.md (database schema from 7 migrations)
  - raw/codebase/portal-app.md (Next.js App Router architecture)
  - raw/codebase/ai-service.md (multi-provider AI chat)
  - raw/codebase/external-tools.md (n8n, Flowise, Univer)
  - raw/codebase/monitoring.md (Sentry, real-time, satellite API)
  - raw/codebase/auth-middleware.md (auth flow, RLS, middleware)
  - raw/codebase/department-features.md (8 departments, tabs, workflows)
- Created 7 wiki pages:
  - concepts/database-schema.md
  - concepts/portal-app-architecture.md
  - concepts/ai-service.md
  - concepts/external-tools.md
  - concepts/monitoring-error-tracking.md
  - concepts/auth-middleware.md
  - concepts/department-features.md
- Updated index.md (13 total pages)
- Ingested 4 raw sources:
  - raw/articles/arch-systems-project-overview.md (project overview)
  - raw/articles/portal-app-readme.md (portal app README)
  - raw/articles/supabase-local-dev-guide.md (Supabase dev guide)
  - raw/articles/deepeval-integration-design.md (DeepEval integration spec)
- Created 6 wiki pages:
  - entities/arch-systems.md
  - concepts/turborepo-monorepo.md
  - concepts/supabase-local-dev.md
  - concepts/deepeval-integration.md
  - concepts/design-system.md
  - concepts/rls-policy.md
- Updated index.md (7 total pages)

## [2026-05-15] update | Version corrections and package documentation

- Updated entities/arch-systems.md:
  - Corrected Next.js 14 → 15, React 18 → 19
  - Added @repo/theme, @repo/hooks, @repo/supabase, @repo/utils to structure
  - Added apps/cms (Payload CMS v3)
  - Added AI SDK, Zustand, version numbers to tech stack
  - Expanded Key Gotchas with React divergence and Tailwind rules
- Updated concepts/turborepo-monorepo.md:
  - Corrected Next.js 14 → 15, React 18 → 19
  - Added @repo/theme, documented all implemented packages (was "Reserved")
  - Added pnpm workspace catalogs documentation
  - Added cms app, port numbers
  - Added commands: pnpm ui, supabase:dev, deploy:local

## [2026-05-15] research | Populated comparisons folder

Researched and created 10 comparison pages documenting key architectural and technical decisions:

1. **ai-providers.md** — Multi-provider AI failover (Groq → OpenRouter → Together)
2. **testing-frameworks.md** — Jest 30 for React 19 + Next.js 15
3. **state-management.md** — Zustand 5 for minimal client state in RSC architecture
4. **rich-text-editors.md** — Novel for Notion-style editing
5. **monorepo-tools.md** — Turborepo 2.1 + pnpm 9.12.0
6. **database-backend.md** — Supabase with PostgreSQL RLS
7. **map-libraries.md** — react-map-gl + MapLibre for open satellite data
8. **styling-approaches.md** — Tailwind CSS with @repo/theme design system
9. **react-patterns.md** — Next.js 15 App Router with RSC default
10. **animation-libraries.md** — Framer Motion for real-time dashboard animations

Updated index.md with comparisons section (23 total pages now).

## [2026-05-15] content | Added operational guides, ADRs, and query pages

Created comprehensive operational content:

**Operational Guides (4)**:

- **troubleshooting.md** — Common development issues and resolutions
- **deployment.md** — Production deployment runbook
- **onboarding.md** — New team member onboarding guide
- **incident-response.md** — Production incident response playbook

**Architecture Decision Records (7)**:

- **adr-001-nextjs-app-router.md** — Next.js 15 App Router adoption
- **adr-002-supabase-backend.md** — Supabase as backend platform
- **adr-003-turborepo-monorepo.md** — Turborepo for monorepo
- **adr-004-tailwind-design-system.md** — Tailwind CSS with design tokens
- **adr-005-zustand-state-management.md** — Zustand for state management
- **adr-006-multi-provider-ai.md** — Multi-provider AI architecture
- **adr-007-react-19-adoption.md** — React 19 adoption strategy

**Query-Based Summaries (6)**:

- **how-to-add-department.md** — Adding new departments
- **how-does-auth-work.md** — Authentication flow explained
- **how-to-fetch-data.md** — Data fetching patterns
- **why-query-returns-empty.md** — Database query debugging
- **how-to-deploy-production.md** — Deployment guide
- **how-to-debug-issues.md** — General debugging

Updated index.md: 42 total pages across all categories.

## [2026-05-15] enhancement | Added VitePress visual wiki renderer

Created VitePress-based documentation site in `docs/` directory:

**Files Created**:

- `docs/package.json` - Package manifest with VitePress dependency
- `docs/wiki/.vitepress/config.mjs` - Site configuration with full navigation
- `docs/wiki/index.md` - Homepage with quick links
- `docs/wiki/quick-reference.md` - Task-based quick reference
- `docs/README.md` - Setup and deployment instructions

**Features**:

- Full-text search across all 42 wiki pages
- Organized sidebar navigation (Getting Started, Concepts, ADRs, Comparisons, Queries, Operations)
- Dark mode by default
- GitHub edit links for each page
- Mobile-responsive design
- Deployable to GitHub Pages, Vercel, or Netlify

**Usage**:

```bash
cd docs
pnpm install
pnpm dev      # Local development
pnpm build    # Static site generation
```

This provides a professional, browsable wiki alternative to the raw markdown files.

## [2026-05-16] enhancement | Database schema review and improvements

- Enhanced docs/wiki/SCHEMA.md with comprehensive database documentation (528 lines)
  - Core entities tables with column specifications
  - Operational tables (daily_logs, machine_hours, fuel_logs, production_logs)
  - Control room tables (machine_operations, hourly_loads, excavator_activity)
  - Safety department tables (safety_incidents, severities, categories)
  - Engineering department tables (breakdowns)
  - AI memory system with vector store
  - Row Level Security policies and helper functions
  - Index strategy and performance recommendations

- Created docs/wiki/SCHEMA_IMPROVEMENTS.md (238 lines)
  - Priority-based improvement plan (Critical, High, Medium, Low)
  - Schema quality scores
  - Implementation phases

- Created migration 010_schema_improvements.sql (141 lines)
  - Added 15+ missing foreign key indexes
  - Added updated_at timestamps to daily_logs, machine_hours, fuel_logs, production_logs
  - Added deleted_at soft delete to operators, sites, mine_blocks, delay_categories, report_templates
  - Created native PostgreSQL enum types (role_type, shift_type, memory_type, etc.)
  - Added constraint for non-negative hourly_loads values

- Updated docs/wiki/concepts/database-schema.md
  - Added migration 008-009-010 references
  - Added schema improvements section
  - Added performance scorecard table

## [2026-05-16] audit | Wiki audit and comprehensive fixes

- Fixed stale migration count (7 → 16) in 5 files:
  - entities/arch-systems.md, concepts/turborepo-monorepo.md, comparisons/database-backend.md
  - raw/articles/arch-systems-project-overview.md, raw/codebase/migrations.md
- Created 7 missing department entity pages:
  - entities/drilling-department.md, entities/production-department.md
  - entities/access-control-department.md, entities/engineering-department.md
  - entities/control-room-department.md, entities/training-department.md
  - entities/satellite-monitoring-department.md
- Installed VitePress in docs/ and fixed broken nav links in config.mjs
- Removed empty raw directories: papers/, tranops/, assets/
- Created \_archive/ directory for superseded pages
- Expanded 4 thin concept pages with concrete examples and references:
  - concepts/rls-policy.md — Added policy template, helper function bodies, role matrix
  - concepts/design-system.md — Added CSS variable reference, color palette, typography
  - concepts/supabase-local-dev.md — Added common commands, troubleshooting section
  - concepts/deepeval-integration.md — Added running tests, custom metric guide, example output
- Computed real SHA-256 hashes for all 11 raw source files
- Updated index.md: 42 → 49 total pages, 2 → 9 entities

## [2026-05-17] enhancement | Git tree visualization & project graph documentation

Created comprehensive git history and graph theory documentation in docs/wiki/gittree/:

**Files Created**:

- gittree/README.md — Complete git graph from project inception through Phase 3, showing all branches, divergence points, and milestones
- gittree/visual-graphs-reporting.md — Data visualization techniques (bar, line, Gantt, scatter, heatmaps) for project metrics and reporting
- gittree/conceptual-code-graphs.md — Program analysis representations (ASTs, CFGs, Call Graphs, CPGs) used by static analyzers and security tools
- gittree/graph-data-structures.md — Graph algorithms (BFS, DFS, Dijkstra, Topological Sort) with TypeScript implementations and real-world applications

**Updates**:

- Updated index.md with git tree section (total pages: 49 → 52)
- Added quick reference links to git history and visualization resources
- Cross-linked all gittree pages with related wiki sections

## [2026-05-17] update | Schema improvements completion & wiki status refresh

**SCHEMA_IMPROVEMENTS.md Updates**:

- Marked migration 016_schema_enhancements.sql as completed:
  - [x] Native enum types (role_type, shift_type, incident_type, memory_type)
  - [x] Composite indexes for dashboard queries
  - [x] Soft delete pattern standardization (deleted_at)
  - [x] Audit trail (created_by) columns added
  - [x] Generated columns (breakdowns.duration_hours)
- Reorganized completed tasks from "Future Improvements" to "Completed Issues"
- Marked phases 1-3 complete; future enhancements moved to Post-Phase 3 section

**Wiki Index Updates**:

- Updated project version from 1.5.1 to Phase 3 (Latest)
- Added git tree resources to quick reference table
- Updated total page count: 49 → 52 pages
- Updated last modified date: 2026-05-16 → 2026-05-17

## [2026-05-17] create | Project comprehensive report → wiki refresh (5 new concept pages)

Based on `project-comprehensive-report.md` §9 — 5 recommended next steps:

**New Pages Created:**

- `concepts/on-premises-deployment.md` — CRITICAL: Linux server provisioning, Cockpit setup, Docker deploy, offline/air-gapped update
- `concepts/testing-qa-strategy.md` — HIGH: Unit coverage 72%→90%+, E2E flows, Storybook visual regression, k6 load testing, OWASP ZAP scan
- `concepts/database-optimization.md` — HIGH: Table partitioning (migrations 017–019), PgBouncer, read replicas, materialized views
- `concepts/mobile-pwa.md` — MEDIUM: PWA manifest, service worker, offline write queue, touch-optimized forms
- `concepts/analytics-reporting.md` — MEDIUM: Executive KPI dashboard, PDF/Excel export, n8n scheduled reports, ML predictive maintenance

**Updated Pages (7):**

- `STATUS.md` — Replaced next-steps with 5 actionable checklists + implementation timeline
- `index.md` — Page count 54 → 59, new quick-reference rows, new concept links
- `entities/arch-systems.md` — Added Phase 4 Roadmap section
- `concepts/deployment.md` — Added Method D: On-Premises Server (Cockpit)
- `queries/how-to-deploy-production.md` — Added Method D: Cockpit 3-step quickstart
- `concepts/database-schema.md` — Added Scaling & Optimization Roadmap section
- `UPDATE_SUMMARY.md` — New entry prepended

## [2026-05-17] update | Incomplete wiki content completion pass

**Enriched department entity pages** (added DB tables, completeness %, mobile status, Phase 4 links):

- `entities/drilling-department.md` — Added DB tables, 72% completeness, mobile status
- `entities/production-department.md` — Added DB tables, 77% completeness, mobile status
- `entities/access-control-department.md` — Added DB tables, 71% completeness, mobile status
- `entities/training-department.md` — Added DB tables, 72% completeness, mobile status
- `entities/safety-department.md` — Added 86% completeness, mobile status, fixed duplicate tag
- `entities/engineering-department.md` — Added 83% completeness, mobile status

**Corrected and expanded concept pages:**

- `concepts/ai-service.md` — Fixed Together AI (wired as tertiary in Phase 3); added Phase 3 additions: pgvector memory, Redis cache, MCP registry, Kiro orchestrator
- `concepts/monitoring-error-tracking.md` — Added Prometheus & Grafana section: ports, scrape config, key metrics, dashboards, alert thresholds

## [2026-05-18] update | Phase 4 & 5 milestones, major feature additions

**Phase 4 — Production Hardening, Observability & Guardrails (commit `a3d53b2`)**

New infrastructure committed prior to wiki catch-up:

- Root tooling, CI, and workspace config updates (4e8bede)
- Devops scripts, tools, monitoring, and infrastructure (60f4bfd)
- `@repo/errors` package added; read-replica Supabase client wired
- Webhook verification infrastructure added
- Migrations 017–027: webhooks, webhook triggers, sync metadata, time-series partitioning, missing indexes, materialized views, pg_cron schedules, drill operations, machine telemetry, drill delays refinement, drill shifts & archiving

**Phase 5 — Multi-Agent Swarm & Advanced Autonomy (commit `830388c`)**

- Pro-workflow split memory architecture established (.remember/)
- Multi-agent swarm patterns, advanced autonomy frameworks
- Cascade snapshot checkpoints recorded

## [2026-05-18] create | Portal app — AI, departments, plugins, webhooks, polish (commit `1ede69e`)

**New pages / features added to portal:**

- AI chat rate limiter, plugin system (Rust telemetry, predictive maintenance, buggy plugin scaffold)
- Webhook manager, export APIs, sync playback
- Executive dashboard (`/hub/executive`)
- New departments wired: drilling, access-control, satellite-monitoring, training
- 3D WebGL silk waves background, custom cursor, offline banner
- Safety, control-room, and engineering dashboards updated
- Visual E2E tests with Playwright snapshots added

## [2026-05-18] update | Packages — theme tokens, UI components, database, errors, eval (commit `332ffdc`)

**Packages updated:**

- `@repo/theme` — generated tokens via Style Dictionary, stylelint config
- `@repo/ui` — GlassCard, DepartmentLayout, FormFields, Mac chrome components
- `@repo/errors` — new shared error package
- Migrations 017–027 (webhooks → drill shifts/archiving)
- Webhook verification utilities; Rust telemetry engine plugin scaffold
- DeepEval metrics and telemetry updated

## [2026-05-19] feat | Light-theme migration, department layouts, and AI orchestrator (commit `e92758b`)

**Light-theme (macOS Sonoma palette) migration:**

- Migrated entire portal from dark to light theme
- Updated `variables.css`, `preset.ts`, `theme-provider`, `theme-toggle`
- Replaced dark backgrounds with semantic light tokens across 40+ files
- Added `AnimatedWavesBackground`, removed `WebGLSilkWaves`/`GlobalBackground`

**Department layouts:**

- Added static layouts for drilling, access-control, engineering
- Established `DepartmentLayout` re-export pattern for static sub-pages
- Fixed tab routing and sidebar remount bugs
- New sub-routes: tire-management, drilling-operations, machine-telemetry

**AI orchestrator:**

- Built LangGraph 8-node agent workflow with Redis rate limiter
- Added `agent-graph.ts`, `agent-state.ts`, `rate-limiter.ts`
- Implemented OpenRouter → Groq provider failover in `providers.ts`

**Performance:**

- Scoped icon imports, lazy-loaded `html5-qrcode`, compressed assets
- Removed framer-motion from root layout, deleted `CustomCursor`
- Compressed `intro.mp4` (1.46 MB → 122 KB), logo PNG → WebP

**Migration 029:** `breakdowns_machine_name` — added machine name field

## [2026-05-19] chore | Vercel deployment config + lockfile update (commit `9ded620`)

- `vercel.json` created for Vercel deployment target
- `pnpm-lock.yaml` updated with dependency resolution

## [2026-05-20] feat | Highlight + OpenTelemetry observability, Inngest background jobs, Novu notifications (commit `b74ba6c`)

**Observability:**

- Wired Highlight error monitoring (`H.consumeError`) into `error-logger.ts`
- Added `HighlightInit` to root layout for session replay
- Instrumented server with Highlight + OTEL `NodeSDK` in `instrumentation.ts`
- Added `withSpan` wrapper for Supabase query tracing
- Wrapped AI agent-graph nodes and provider failover in spans

**Background jobs:**

- Added Inngest client, `sync-playback` and `report-generation` jobs
- Refactored `sync/playback` API to queue events via Inngest
- Rewrote `sync/playback` route tests for new queuing contract

**Notifications:**

- Added Novu client singleton and notification workflow triggers

**Migrations 030–031:** vector index optimization, embedding sync watermarks

## [2026-05-20] feat | QR access control dashboard, audit logs, semantic status colors (commit `74d5ba2`)

**Access Control — QR Dashboard:**

- 7 new dashboard components: KPI grid, charts, activity feed, entity status, hourly access chart, QR status distribution chart, dashboard entity status
- 5 access-logs components: filters, table, detail modal, data layer, `StatusBadge`
- `DashboardKPIGrid`, `DashboardActivityFeed`, `DashboardChartsRow` wired

**Theme:**

- Added `success`, `warning`, `danger`, `info` semantic color tokens to theme

**Design system compliance:**

- Removed dark mode classes, `transition-all`, raw shadows across 20+ files
- Added `aria-label` attributes, lazy-loaded `AnimatedWavesBackground`

**CI/Deployment:**

- GitHub Actions deploy workflow (`.github/workflows/deploy.yml`) — 225-line production pipeline
- `DEPLOYMENT.md` expanded with 341-line runbook

**Migration 032:** `ai_usage_logs` — tracks token consumption per AI request

## [2026-05-20] feat | Access logs archival migration, theme token pipeline, deploy tooling (commit `304f0dc`)

- **Migration 033:** `access_logs_weekly_archival` — pg_cron weekly archival job (87 lines)
- **Style Dictionary pipeline** in `pkgs/theme`:
  - `sd.config.mjs` generating CSS variables and TypeScript tokens
  - `src/tokens/generated-sd.ts` (2567 lines), `variables-generated.css` (160 lines), `tokens-hsl.json`
  - `DECISIONS.md` documenting token architecture choices
- Deploy script improvements in `ops/deploy.sh`
- New `ops/generate-db-docs.sh` for automated DB documentation

## [2026-05-20] feat | Pilot-shell workflow integration + session catch-up (commit `80c02b6`)

- Pilot-shell workflow patterns integrated
- `.claude/rules/` directory created:
  - `development-practices.md`
  - `task-workflow.md`
  - `testing.md`
  - `verification.md`
- Session context catch-up and agent coordination patterns

## [2026-05-23] chore | Remove unnecessary dev infrastructure files (commit `bfb627c`)

- Cleaned up redundant tooling, scripts, and config artifacts from dev environment
- Reduced repository noise from experimental tooling

## [2026-05-25] wip | Sync portal AI, theme tokens, scripts and tooling (commit `c25ac33`)

**AI service rebuild:**

- `lib/ai/ai-service.ts` rewritten (711-line refactor)
- `lib/ai/agent-graph.ts` updated (88-line LangGraph wiring)
- `lib/ai/agent-state.ts` type alignment
- `ai-service.test.ts` updated (519-line test suite)
- AI handoff, predict, safety API routes updated

**Access Control:**

- `access-control/actions.ts` expanded (494 lines, full CRUD + RLS-safe server actions)
- `DashboardKPIGrid` data binding added
- `access-control/page.tsx` refactored (91 lines)

**Admin data API:**

- `/api/admin/data/[table]/route.ts` added (196 lines — generic table CRUD with RLS lockdown)

**Hub:**

- `app/(hub)/page.tsx` updated with `unstable_cache` optimization (88 lines)
- `features/hub/components/IntroVideo.tsx` added (132 lines)

**Migrations 034–044:**

- 034: `access_control_schema_updates` — visitors restructured (first_name/surname/id_number), badges expanded for fleet/equipment
- 035: `fleet_and_equipment_tables` — new `fleet` and `equipment` tables for access-control
- 036: `documents` — word-processing storage, Supabase storage bucket, version history
- 037: `personnel_area` — area/zone assignments for personnel
- 038: `department_personality` — AI personality/SOUL.md column on `departments` table
- 039: `access_logs_operator_device` — device tracking for access log entries
- 040: `access_control_production_fixes` — RLS and constraint corrections
- 041: `rls_performance_indexes` — targeted indexes for RLS policy evaluation
- 042: `machine_configurations` — per-department operational setpoints (RPM, power, hydraulic pressure)
- 043: `admin_data_lockdown` — restricts generic admin data API to superadmin role
- 044: `access_control_dashboard` — department_id + entity FK additions to badges

**Plans documented:**

- `.claude/plans/access-control-data-connectivity.md` (206 lines — access control data wiring plan)

## [2026-05-25] fix | ESLint configs for cms/overview, lint errors, turbo env vars (commit `c87f5f0`)

- Added `.eslintrc.js` to `apps/cms` and `apps/overview`
- Fixed lint errors in `apps/overview` sections (DatabaseSchema, SystemArchitecture, data.ts)
- Fixed `access-control` dashboard component lint warnings
- Fixed `lib/ai/cost-tracker.ts` export alignment
- Added missing turbo env vars to `turbo.json`
- Updated `pnpm-lock.yaml` with full dependency resolution

**Migrations 045–047:**

- 045: `add_access_control_role` — new `access_control` role enum value
- 046: `control_room_archiving` — archival strategy for control room time-series data
- 047: `machines_site_id` — adds `site_id` FK to machines table

## [2026-05-27] wip | Sync accumulated changes across portal, cms, overview, packages (commit `f2b33cf`)

**Agent/command tooling (.claude/ + .kiro/):**

- New agents: context-engineer, cost-analyst, permission-analyst, digital-twin, team-lead
- New commands: doctor, handoff, insights, parallel, replay, context-optimizer
- Updated commands: commit, deslop, safe-mode, sprint-status, wiki
- `.claude/settings.json` updated with permission and behavior rules
- `.kiro/` directory mirrored with matching agent/command config

**Environment:**

- `.env` updated (115-line full env with all service keys)
- `.env.example` updated (72 lines)
- `.env.tools` updated (25 lines)
- Portal `.env.portal.compose.example` (23 lines) and `.env.production.example` (10 lines)

**Documentation:**

- `CLAUDE.md` comprehensive update
- `DESIGN.md` updated with light-theme details
- `DEPLOYMENT.md` updated
- `README.md` updated

**Migration 048:** `machine_report_exempt` — flag to exclude machines from automated report generation

## [2026-05-27] chore | Clean build artifacts, fix pre-commit hook, format project (commit `7d0a059`)

- Removed `.next`, `dist`, `.turbo`, `node_modules/.cache` directories from tracking
- Added `docs/reports/` to `.eslintignore`
- Added missing `@secretlint/secretlint-rule-preset-recommend` devDependency
- Updated `turbo` 2.9.14 → 2.9.15, `lint-staged` 17.0.4 → 17.0.5
- Ran `pnpm format` across 43 files
- `pnpm quality` gate passes (lint → type-check → test → lint:tokens → lint:css → format-check)

## [2026-06-01] update | Performance optimization — blurriness fix (commit `011a577`)

Root-caused and fixed blurry rendering across the entire portal. Three categories of fix: scroll smoothness, backdrop-filter GPU cost, and adaptive performance responsiveness.

**Lenis smooth scroll:**

- `apps/portal/components/SmoothScrollProvider.tsx` — Reduced `duration` from 1.2s to 0.6s, halving scroll animation lag
- Added `visibilitychange` listener to pause `requestAnimationFrame` loop when tab is hidden (saves GPU cycles)

**backdrop-filter blur reduction:**

- `pkgs/theme/src/css/glass.css` — `.glass` base class: 16px→10px blur, saturate 160%→130%; `.glass-card`: 12px→10px blur, 120% saturate
- `pkgs/theme/src/css/variables.css` — `--glass-video-backdrop`: 24px→16px; `--glass-premium-backdrop`: 24px→16px

**Adaptive performance fallback:**

- `apps/portal/hooks/useAdaptivePerformance.ts` — Threshold tightened from 45→50 FPS, detection window from 3s→1.5s so `.low-perf-fallback` disables animations sooner

**Verification:** 51 test suites / 480 tests pass, lint 0 errors, TypeScript 0 errors.

## [2026-06-03] update | Nx and Local Ollama Migration (commit `f04974e`)

Documented the migration from Turborepo to Nx build orchestration and the AI service transition to local Ollama for air-gapped offline support.

**Nx Migration:**

- Created [[nx-monorepo]] detailing Nx layout, target configuration caches, pnpm workspace catalogs, and commands.
- Created [[adr-008-nx-monorepo]] to justify Turborepo -> Nx 22 migration.
- Marked [[adr-003-turborepo-monorepo]] as superseded.
- Updated [[comparisons/monorepo-tools]] with Nx as primary tool choice.

**AI Localisation:**

- Overwrote [[ai-service]] detailing local Ollama execution (gemma4 chat, nomic 768-dim embeddings), LLM-driven tool dispatch, persistent embedding cache, and tool caching.
- Created [[adr-009-local-ollama-ai]] to justify local AI execution.
- Marked [[adr-006-multi-provider-ai]] as superseded.
- Dropped procedural memory type in schema documentation, updating migrations coverage up to 61.

**Project Status Updates:**

- Updated [[STATUS]] and [[PROJECT_STATUS_SUMMARY]] to Phase 5.2.
- Updated [[index]] and [[entities/arch-systems]].

## [2026-06-15] lint | Wiki stale content cleanup

- Deleted 10 auto-generated noise files from `docs/wiki/questions/` and `docs/wiki/archived/`
- Fixed staleness in [[portal-app-architecture]]: Turborepo→Nx, dark theme→light-only, added Zustand
- Fixed [[STATUS]]: Phase 5.1→5.2, Next.js version contradiction
- Swept Turborepo→Nx references in 7 files (onboarding, troubleshooting, how-to-deploy-production, security-posture, final-project-readiness, project-comprehensive-report, project-stability-analysis)
- Added frontmatter to `breakdown/*.md` files
