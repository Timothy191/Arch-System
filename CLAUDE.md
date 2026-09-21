# CLAUDE.md — Arch-Systems Technical Guide

Authoritative technical reference for the Arch-Systems (Plantcor) Mining Operations Portal.
This file governs **how to work in this codebase**. For agent workflow rules, see `AGENTS.md`.

---

## 1. Project At-a-Glance

| Concern         | Detail                                           |
| --------------- | ------------------------------------------------ |
| Name            | Arch-Systems (Plantcor) Mining Operations Portal |
| Type            | Turborepo monorepo (pnpm workspaces)             |
| Primary App     | `apps/portal` — Next.js 16, React 19, App Router |
| Backend         | Supabase (PostgreSQL + Auth + RLS)               |
| Package Manager | pnpm 9.15.9 (pinned via `packageManager` field)  |
| Node Engine     | >=22 (Volta-pinned to 24.15.0)                   |
| Lint            | Biome + ESLint + Stylelint + cspell              |
| Testing         | Jest (unit), Playwright (e2e), DeepEval (AI)     |

---

## 2. Workspace Layout

```
Arch-System/
├── apps/
│   └── portal/              # Next.js 16 App Router — the main application
├── packages/                # Shared publishable packages (@repo/*)
│   ├── agents/              ├── Agent coordination & specialists (MCP, OpenAI)
│   ├── contract/            ├── Zod schemas & type definitions (data contracts)
│   ├── database/            ├── SQL migrations (source of truth) + rollback tests
│   ├── errors/              ├── Structured error classes with cause tracking
│   ├── eslint-config/       ├── Shared ESLint configurations
│   ├── eval/                ├── DeepEval LLM evaluation suite (Python)
│   ├── logger/              ├── Structured Pino logging (server/browser/Next.js)
│   ├── rate-limiter/        ├── Rate limiting framework (DI, multiple strategies)
│   ├── redis/               ├── Redis client, caching helpers, TTL registry
│   ├── supabase/            ├── Supabase clients + Kysely query builders
│   ├── theme/               ├── OKLCH design tokens, Tailwind preset, CSS variables
│   ├── typescript-config/   ├── Shared TypeScript configurations
│   ├── ui/                  ├── Radix/shadcn UI components (GlassCard, KPI, etc.)
│   └── utils/               ├── Third-party integration helpers (Novu, Inngest)
├── libs/
│   ├── features/            # Domain feature modules (scope:feature)
│   │   ├── auth/            ├── Auth feature
│   │   ├── departments/     ├── Department dashboards (drilling, production, etc.)
│   │   ├── hub/             ├── Central hub navigation
│   │   └── ...
│   └── shared/              # Shared utilities, data-access, hooks
├── services/                # Integration services (third-party API clients)
│   └── integrations/        ├── OpenRouter, Cohere, n8n clients
├── tools/                   # Build, analysis, and audit scripts
├── scripts/                 # Local dev & deployment utility scripts
├── docs/                    # Documentation (DESIGN.md, DEPLOYMENT.md, etc.)
├── config/                  # Tool configurations (eslint, turbo, etc.)
├── infra/                   # Docker compose, monitoring configs
├── e2e/                     # Playwright end-to-end tests
├── k6/                      # Load testing scripts
└── documentation/           # Unified documentation center
```

---

## 3. Common Commands

### Development

```bash
pnpm dev              # Start portal dev server (syncs assets first)
pnpm dev:quick        # Headless dev (quick boot)
pnpm dev:turbo        # Portal dev via Turborepo
pnpm dev:tools        # Start Docker tools stack (Flowise, Redis, etc.)
```

### Build & Quality

```bash
pnpm build            # Build all apps and packages
pnpm type-check       # TypeScript type-check across workspace
pnpm lint             # Lint all packages (Biome, ESLint, Stylelint, cspell)
pnpm quality          # Full quality gate (lint + type-check + tests + policy checks)
pnpm knip             # Dead code detection
pnpm deps:lint        # Dependency version consistency (syncpack)
```

### Database & Migrations

```bash
pnpm --filter @repo/database supabase:dev     # Start local Supabase stack
pnpm --filter @repo/database supabase:gen     # Generate database types
pnpm --filter @repo/database db:types         # Alias for type generation
pnpm db:seed              # Seed development database
pnpm db:schema-reload     # Reload schema from migrations
```

### Testing

```bash
pnpm test                # Run all tests (Jest + Playwright via Turbo)
pnpm test:watch          # Watch mode
pnpm test:coverage       # Coverage report
pnpm test:e2e            # Playwright E2E tests
pnpm --filter portal test -- --testPathPatterns="<name>"  # Targeted test
```

### Audits & Code Generation

```bash
pnpm audit:suite         # Full compliance audit (RLS, design tokens, contracts)
pnpm audit:design        # Design system compliance check
pnpm audit:drift         # API contract drift detection
pnpm audit:rls           # Row-Level Security audit
pnpm audit:rls-matrix    # RLS policy coverage matrix
pnpm maps:gen            # Generate codebase maps (Mermaid diagrams)
pnpm onboards            # Run workspace diagnostic suite
```

### Deployment

```bash
pnpm deploy:local        # Full stack local deployment
pnpm deploy:staging      # Staging deployment
pnpm deploy:production   # Production deployment
pnpm deploy:rollback     # Rollback last deployment
```

---

## 4. Conventions & Rules

### Code Style

- **TypeScript**: Strict mode throughout. No `any` or `@ts-ignore`.
- **Imports**: Use `@repo/*` for workspace packages. Feature-scoped imports use `@repo/<pkg>/path`.
- **Light mode only**: No `dark:` Tailwind classes. Luminance must stay > 200.
- **Design tokens**: Always use OKLCH tokens from `@repo/theme`. Never raw hex colors (except in documentation).
- **Shadows**: Use named shadow tokens (`shadow-card`, `shadow-window`, etc.) — never raw `shadow-sm`/`shadow-lg`.
- **Glass cards**: Use `<GlassCard>` for all card surfaces. Legacy `SpotlightCard` and `GlowBorderCard` are removed.

### Architectural Boundaries

- `apps/portal` must not import DB internals directly; go through `@repo/supabase`.
- `packages/contract` is the canonical Zod schema source — never hand-edit generated types.
- `@repo/rate-limiter` does NOT depend on `@repo/redis`; uses dependency injection.
- Public package APIs must export strictly from `src/index.ts`.

### Environment

- Portal env lives in `apps/portal/.env` (copied from `apps/portal/env/.env.example`).
- Root `.env` is used for tooling (Docker, monitoring, AI providers).
- See `docs/ENVIRONMENT_FILES_GUIDE.md` for the full file reference.

---

## 5. Key Files & Entrypoints

| File                             | Purpose                             |
| -------------------------------- | ----------------------------------- |
| `apps/portal/app/`               | Next.js App Router routes           |
| `apps/portal/app/(auth)/`        | Auth routes (login, register, etc.) |
| `apps/portal/app/api/health`     | Health check endpoint               |
| `apps/portal/app/layout.tsx`     | Root layout, providers              |
| `apps/portal/app/page.tsx`       | Hub / department grid               |
| `packages/database/migrations/`  | SQL migrations (113+ files)         |
| `packages/contract/src/schemas/` | Zod schemas (canonical data shapes) |
| `packages/theme/src/tokens/`     | Design tokens (OKLCH, CSS vars)     |
| `packages/supabase/src/`         | Supabase + Kysely clients           |
| `libs/features/departments/`     | Department-specific UI & data       |

---

## 6. Debugging Tips

- **Type errors after migration**: Run `pnpm --filter @repo/database supabase:gen` to regenerate types.
- **RLS issues**: Run `pnpm audit:rls` to check policy coverage.
- **Design violations**: Run `pnpm audit:design` to catch forbidden patterns.
- **Port conflicts**: The dev script auto-resolves by killing stale processes.
- **Auth not working**: Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env`.
- **Cache issues**: Clear `.next/cache/` and restart the dev server.

---

## 7. Tracing & Observability

- **Agent tracing**: Inline `// AGENT-TRACE:` comments in source mark decision points.
- **AGENT_TRACER.md** files exist in each package — update when modifying that package.
- **Structured logging**: Use `@repo/logger` — never `console.log` in production code.
- **Telemetry**: OpenTelemetry is configured via `@vercel/otel`; traces flow to the configured OTLP endpoint.
- **Error monitoring**: Sentry is configured for both client and server.

Last updated: 2026-09-21
