# Arch-System — Architecture & Data Flow

> Extracted from the former monolithic `AGENTS.md` (51,679 bytes), which Antigravity truncated at 24,000 bytes on every request. Loaded on demand.

## Architecture & Data Flow

### High-Level Structure

The repository is structured as a **pnpm workspaces + Turborepo 2.x** monorepo:

- **`apps/portal`**: High-density Next.js 16 (React 19) App Router web application with standalone output mode and Turbopack support.
- **`packages/*`**: Foundational domain-agnostic packages (`@repo/contract`, `@repo/errors`, `@repo/supabase`, `@repo/database`, `@repo/redis`, `@repo/rate-limiter`, `@repo/logger`, `@repo/theme`, `@repo/ui`, `@repo/agents`, `@repo/eval`, `@repo/utils`, `@repo/typescript-config`).
- **`libs/*`**: Domain feature slices (`libs/features/auth`, `libs/features/departments`, `libs/features/hub`) and cross-cutting domain utilities (`libs/shared/data-access`, `libs/shared/hooks`, `libs/shared/utils`).
- **`tools/*`**: Build-time monorepo governance, Single Source of Truth policy compiler, AST compound bash safety check, and audit suites.
- **Background Engines**: Arch-CorpOS autonomous business loops (`.agents/corpos/bin/corpos`), Rust Tokio swarms (`tools/swarms-orchestrator`), and Inngest background event workflows (`@repo/utils/inngest`).

```
                           +-----------------------------------+
                           |    Browser / Field Terminal       |
                           +-----------------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           |   apps/portal/proxy.ts (Edge)     |
                           |   • Session validation            |
                           |   • Employee role resolution      |
                           |   • Security headers & CSP nonces |
                           +-----------------------------------+
                                             |
                     +-----------------------+-----------------------+
                     v                                               v
+------------------------------------------+    +------------------------------------------+
|  Server Actions / Route Handlers (API)   |    |         React Server Components          |
|  • Zod validation (@repo/contract)       |    |  • Read-only data queries                |
|  • Canonical AppError hierarchy          |    |  • OKLCH design tokens (@repo/theme)     |
|  • OpenTelemetry tracing & idempotency   |    |  • Pure UI components (@repo/ui)         |
+------------------------------------------+    +------------------------------------------+
                     |                                               |
                     v                                               v
+------------------------------------------------------------------------------------------+
|                                    Service Layer                                         |
|  • Two-tier Caching: L1 Memory LRU (1000 items) + L2 Redis with XFetch (@repo/redis)     |
|  • Multi-Strategy Rate Limiter: RedisStore / MemoryStore (@repo/rate-limiter)            |
|  • Structured Telemetry & Tracing: Pino + OpenTelemetry (@repo/logger)                  |
+------------------------------------------------------------------------------------------+
                     |
                     v
+------------------------------------------------------------------------------------------+
|                            Data Persistence (@repo/supabase)                             |
|  • PostgreSQL 15+ with Row Level Security (RLS) policies on every table                  |
|  • Stored Procedures & Atomic RPCs (packages/database/migrations/NNN_*.sql)              |
|  • Realtime CDC streaming (useSupabaseRealtime) & Kysely query builder                   |
+------------------------------------------------------------------------------------------+
```

### Monorepo Boundary Invariants

Enforced by `tools/repo/policy-compiler.cjs` via `tools/repo/policy/dependency.rules.json` and ESLint boundaries:

1. **No direct database access in apps**: `apps/*` MUST NOT import `packages/database` directly — data persistence routes through `@repo/supabase` or typed services.
2. **Pure UI components**: `packages/ui` MUST remain strictly pure presentational — zero database, Supabase, or backend access.
3. **Theme isolation**: `packages/theme` MUST NOT import `packages/ui`.
4. **No inverse dependencies**: `packages/*` and `tools/*` MUST NOT import `apps/*` (strict dependency inversion).
5. **Build-time tools isolation**: `tools/*` are build-time scripts; prohibited from importing runtime application packages.

### Key Functional Modules

- **Control Room & SCADA Operations** (`apps/portal/app/(departments)/control-room/`): Real-time dumper cycle times, excavator loading rates, delay logging (`delay_entries`), and atomic shift closeout (`/api/control-room/shift-closeout`) invoking the PostgreSQL `atomic_shift_closeout` stored procedure with SHA-256 payload idempotency.
- **Engineering & Fleet Reliability** (`apps/portal/app/(departments)/engineering/`): Equipment breakdown logging, SMR (Service Meter Reading) hour tracking, and tire life wear analysis.
- **Drilling Telemetry** (`apps/portal/app/(departments)/drilling/`): Bit depth and penetration tracking with Server-Sent Events (SSE) streaming via `/api/telemetry/drilling/stream`.
- **Access Control & Badging** (`apps/portal/app/(departments)/access-control/`): RFID coal truck tracking, visitor inductions, QR credential issuance, and hardware badge printing.
- **AI Agent Fleet & Tracing** (`packages/agents`): Multi-agent orchestration, reflection loops, and Langfuse observability (`packages/agents/src/langfuse.ts`).

### End-to-End Data Flow

1. **Request Ingress & Auth**: Handled by `apps/portal/proxy.ts`, validating Supabase SSR auth cookies, looking up department permissions in `employees`, and attaching CSP nonces.
2. **Contract Validation**: Incoming mutation payloads and query params are strictly parsed using canonical Zod schemas from `@repo/contract`.
3. **Caching Layer**: Queries consult the `@repo/redis` two-tier cache (L1 in-memory LRU, L2 Redis with XFetch probabilistic early expiration). Mutations trigger tag-based cache eviction (`cacheInvalidateTags`).
4. **Database Execution**: Database operations execute via `@repo/supabase` (server client or Kysely instance) with active PostgreSQL Row Level Security (RLS) enforcement.
5. **Real-time Synchronization & Resilience**: Field terminals receive updates via Supabase Realtime channels (`useSupabaseRealtime`). If pit connectivity degrades, `usePitConnectivity` alerts the UI and `useOfflineQueue` buffers mutations in `localStorage` (`arch_*_draft_*`), auto-replaying them upon reconnection.

---

## Key Directories

| Directory Path           | Purpose & Responsibilities                                                                                                          |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/portal/`           | Main Next.js 16 (React 19) App Router portal application (`app/`, `features/`, `hooks/`, `lib/`, `proxy.ts`).                       |
| `packages/contract/`     | Canonical Single Source of Truth for Zod schemas, TypeScript types, and OpenAPI specifications.                                     |
| `packages/errors/`       | Standardized `AppError` class hierarchy, error codes, and TypeScript type guards.                                                   |
| `packages/supabase/`     | SSR/browser Supabase client factories (`/server`, `/client`, `/middleware`), Kysely client (`/kysely`), and query instrumentation.  |
| `packages/database/`     | 164+ sequential PostgreSQL migrations (`migrations/NNN_*.sql`), rollback scripts, and safety tests.                                 |
| `packages/redis/`        | Two-tier (L1 Memory LRU / L2 Redis) caching layer with XFetch early expiration, TTL registry, and tag invalidation.                 |
| `packages/rate-limiter/` | Distributed multi-strategy rate limiters (sliding window, token bucket, fixed window) with DI stores.                               |
| `packages/logger/`       | Structured JSON logger powered by Pino (`serverLogger`, `browserLogger`) with OpenTelemetry correlation.                            |
| `packages/theme/`        | Style Dictionary token compiler, OKLCH design tokens, glass physics, and Tailwind preset.                                           |
| `packages/ui/`           | Pure React 19 UI component library (GlassCard, DataGrid, KPI cards, Radix primitives) and Storybook catalog.                        |
| `packages/agents/`       | Multi-agent execution engine, LangGraph workflows, Langfuse LLM telemetry, and reflection engine.                                   |
| `packages/eval/`         | DeepEval and Pytest LLM evaluation suites and golden test datasets (Python `>=3.10`).                                               |
| `packages/utils/`        | Shared utilities: resilient fetch client with circuit breaker, Inngest triggers, n8n integration, offline storage.                  |
| `libs/features/`         | Modular domain feature packages (`departments`, `auth`, `hub`) with separate UI and data-access layers.                             |
| `libs/shared/`           | Cross-domain shared React hooks (`useSupabaseRealtime`, `usePitConnectivity`), data access clients, and telemetry circuit breakers. |
| `tools/repo/`            | Architecture and dependency boundary compilers (`policy-compiler.cjs`, `dependency.rules.json`).                                    |
| `tools/scripts/`         | Quality gates (`enforce-quality-gates.sh`), AST compound-bash safety checker (`check-compound-bash.cjs`), and hooks bridge.         |
| `tools/audits/`          | Drift verification tools: token compliance, contract drift, RLS matrix, and bundle sizes.                                           |
| `infra/docker/`          | Docker Compose definitions for companion stacks (`compose.tools.yml`, `compose.ai-tools.yml`, `compose.portal.yml`).                |
| `e2e/`                   | Playwright end-to-end and visual regression test suites with cached auth state (`e2e/.auth/user.json`).                             |

---
