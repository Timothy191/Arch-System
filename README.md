# Arch-Systems (Plantcor / Arch OS) Mining Operations Portal

[![Deployment](https://img.shields.io/badge/Vercel-Production-000000?logo=vercel)](https://arch-system-kappap.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.6-000000?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.7-61DAFB?logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17-3ECF8E?logo=supabase)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-d4af37.svg)](LICENSE)

A production, multi-departmental industrial mining operations portal built as a **Turborepo 2.x + pnpm 9.15.9** monorepo. It provides authenticated, role-scoped access to department workspaces for **Control Room**, **Drilling**, **Production**, **Plant & Processing**, **Plant Inventory**, **Engineering**, **Availability & Utilization**, **Access Control**, **Office**, **Executive Hub**, **System Overview**, and **Database Administration**, backed by live SCADA telemetry, shift closeout workflows, and audit-logged PostgreSQL 17 Row-Level Security (RLS).

## 🏗️ Architecture

This repository is organized as a **Turborepo 2.x** monorepo using **`pnpm@9.15.9`** on **Node.js `>=24.0.0`**.

### Applications (`apps/`)

- **`portal`**: The sole deployable Next.js 16.4.6 (App Router + React 19) application (`package.json` name: `portal`). Hosts all departmental workspaces, live SCADA & telemetry dashboards, shift closeout sheets, the Native Observability & CI Console (`/admin/observability`), `/overview` topology explorer, and `/docs` interactive reference.

### Packages (`packages/`)

- **`@repo/theme`**: Light-mode OKLCH design tokens, canonical Metallic Gold (`--accent-gold` / `#d4af37`) brand tokens, Style Dictionary codegen, and Tailwind CSS preset (Single Source of Truth).
- **`@repo/ui`**: Presentational React 19 components (`GlassCard`, `Logo`, `EveLogo`, `HeroRotator`, `DepartmentLayout`, `MacMenuBar`) built with Radix UI and Tailwind CSS.
- **`@repo/contract`**: Canonical Zod 4 schemas and inferred TypeScript types (`./validation`, `./schemas/*`, `./types/*`). Every database table and API boundary maps to a schema verified by `pnpm audit:drift`.
- **`@repo/supabase`**: Typed Supabase clients (`./server`, `./client`, `./middleware`, `./proxy`, `./read-replica`, `./service-role`) and pooled Kysely query builder (`./kysely`).
- **`@repo/database`**: Immutable PostgreSQL 17 SQL migrations SSoT (`packages/database/migrations/NNN_snake_case.sql`, 172+ applied migrations with strict RLS).
- **`@repo/redis`**: Capability-only Redis layer (`./cache` L1/L2 + tag invalidation, `./session` auth sessions with privilege-version revocation, `./analytics`, `./search` RediSearch + pgvector fallback, streams, and distributed locks).
- **`@repo/intelligence`**: Operational mining intelligence engines (`TelemetryAnomalyEngine`, `PredictiveMaintenanceEngine`, `ProductionForecastEngine`, `ShiftIntelligenceEngine`, `OperationsCopilotEngine`).
- **`@repo/rate-limiter`**: Pluggable `RateLimiter` (`MemoryStore` / `RedisStore` x `FixedWindowStrategy` / `SlidingWindowStrategy` / `TokenBucketStrategy`).
- **`@repo/errors`**: Structured `AppError` hierarchy and `isAppError` boundary guards.
- **`@repo/logger`**: Structured Pino logging (`./server`, `./browser`, `./next`).
- **`@repo/utils`**: Shared client/server utilities, VibeMon telemetry client (`./vibemon`), Inngest, Novu, n8n, offline IndexedDB queue (`./offline-storage`), and Excel export helpers.
- **`@repo/agents`**: Multi-agent orchestration, swarm coordination, and token-budget management.
- **`@repo/eval`**: Python DeepEval LLM evaluation suite (`pyproject.toml`).
- **`@repo/typescript-config`**: Strict shared TypeScript (`5.9.3`) configurations.

### Libraries (`libs/`)

- **`libs/features/*`**: Domain vertical slices (`auth`, `departments`, `hub`) partitioned into `ui`, `data-access`, and `utils`.
- **`libs/shared/*`**: Cross-cutting `@repo/shared/hooks` (`useSupabaseRealtime`, `useOfflineQueue`, `useThrottledDebounce`, `useRedisCache`), `@repo/shared/data-access`, and `@repo/shared/utils` (`env.ts` Zod/t3-env validator, `cache-utils.ts`).

## 🚀 Quick Start

### Prerequisites

- **Node.js `>=24.0.0`** (`.nvmrc` and `.node-version` pin `24`)
- **`pnpm@9.15.9`** (enforced via `packageManager` — never use `npm`, `yarn`, or `bun`)
- **Cloud Supabase** credentials configured in `apps/portal/.env` + **Docker** for local Redis (`pnpm redis:up`)

### One-Command Setup (Clone & Run)

```bash
git clone https://github.com/Timothy191/Arch-System.git
cd Arch-System
./setup.sh --dev
```

This command will:

1. Validate Node.js (`>=24.0.0`) and `pnpm@9.15.9`.
2. Install all monorepo dependencies (`pnpm install --frozen-lockfile`).
3. Configure `apps/portal/.env` from `.env.example` templates.
4. Compile design tokens (`@repo/theme`) and architectural boundary policies (`pnpm policy:check`).
5. Launch the local Redis stack and start the portal on `0.0.0.0:3000`.

### Setup Options

```bash
./setup.sh             # Setup only (dependencies, tokens, env)
./setup.sh --dev       # Setup and launch development server on 0.0.0.0:3000
./setup.sh --start     # Setup, build, and launch production server on 0.0.0.0:3000
./setup.sh --clean     # Clean reinstall: wipes node_modules/cache and reinstalls cleanly
```

### GitHub Codespaces / DevContainer

A preconfigured `.devcontainer/devcontainer.json` (Node 24, Rust 1.85.0, Python 3.12, Redis 7.4 sidecar) is included for instant cloud or VS Code DevContainer onboarding.

## 🛠️ Key Commands

- `pnpm dev`: Start the full development stack (local Redis `:6379` + RedisInsight `:5540`, asset sync, and portal `:3000`).
- `pnpm dev:quick`: Fast headless portal dev server against Cloud Supabase (skips Docker).
- `pnpm redis:up`: Start local Redis 7.4 + RedisInsight independently.
- `pnpm build`: Sync assets, patch glass CSS, and build all workspace packages (`turbo run build`).
- `pnpm type-check`: Run strict TypeScript checking across the workspace (`turbo run type-check --concurrency=2`).
- `pnpm lint`: Run Biome 2.5 across the monorepo (`pnpm lint:styles`, `pnpm lint:spelling`, `pnpm md:lint` for CSS/spelling/Markdown).
- `pnpm test`: Run Jest unit/integration suites across all packages.
- `pnpm agent:verify`: **Mandatory 28-gate fail-fast verification suite** (emits `.ci-local/agent-verify-evidence.json`).
- `pnpm ci:gatekeeper`: Autonomous local CI gatekeeper — verifies or reads `.ci-local/agent-verify-evidence.json` and publishes all 6 required GitHub ruleset commit statuses.
- `pnpm wiki:sync`: Audit `docs/wiki/*` (`pnpm audit:wiki`) and synchronize governed pages (`Home.md`, `_Sidebar.md`, `_Footer.md`, entities, concepts, comparisons, queries) to the GitHub Wiki repository.
- `pnpm vibemon:status` / `pnpm vibemon:track`: Inspect and emit real-time VibeMon multi-agent telemetry.
- `pnpm quality`: Full release-grade verification suite.

## 📖 Documentation

### Unified Documentation & Knowledge Base

- **[AGENTS.md](AGENTS.md)**: Canonical repository guidelines, architecture boundaries, 8-step Server Action security sequence, and 28-gate verification runbook (`CLAUDE.md` symlinks to `GEMINI.md` for compact operational directives).
- **[GEMINI.md](GEMINI.md)**: Compact operational directive and non-negotiable invariants for AI coding agents.
- **[docs/wiki/index.md](docs/wiki/index.md)**: Governed technical wiki catalog (entities, concepts, ADRs, comparisons, operational runbooks, and queries), audited via `pnpm audit:wiki` and synced to the [GitHub Wiki](https://github.com/Timothy191/Arch-System/wiki).
- **[docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)**: Complete navigation index across `docs/` and `documentation/`.
- **[documentation/README.md](documentation/README.md)**: Tool-generated documentation center and `documentation/03-audit-reports/` compliance ledger.
- **[codebase-maps/README.md](codebase-maps/README.md)**: Automated dependency, route, and schema topology maps.

### Design, Product, Deployment, & Security

- **[docs/DESIGN.md](docs/DESIGN.md)**: Light-mode OKLCH design system, Metallic Gold (`#d4af37`) brand tokens, liquid-glass surfaces, and typography scale.
- **[docs/PRODUCT.md](docs/PRODUCT.md)**: Product strategy, industrial operator personas, and departmental workflows.
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Vercel production (`arch-system`), Docker observability stack (`compose.observability.yml`), and Rocky Linux/RHEL deployment guide.
- **[docs/ONBOARDING.md](docs/ONBOARDING.md)**: Developer onboarding checklist.
- **[.github/SECURITY.md](.github/SECURITY.md)** & **[docs/SECURITY.md](docs/SECURITY.md)**: Security policy, Private Vulnerability Reporting, and enforced controls.
- **[CHANGELOG.md](CHANGELOG.md)**: Release history and production milestones.

---

_Built for industrial-scale vigilance and operational precision._
