# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

Always execute from `Arch-System/`:

```bash
# Development
pnpm dev              # Full dev system (binds 0.0.0.0:3000)
pnpm dev:quick        # Headless quick boot (no Docker)
pnpm dev:turbo        # Portal dev via Turborepo

# Build & Quality Gates
pnpm build            # Full Turborepo build
pnpm type-check       # Workspace TypeScript check
pnpm lint             # Linting (Biome)
pnpm quality          # Full quality gate (lint, types, test, tokens, CSS)
pnpm agent:verify     # MANDATORY verification before completing any task
pnpm audit:browser    # Closed-loop browser, devtools & a11y probe (frontend)

# Testing
pnpm test                     # All unit tests (Jest 30 SSoT)
pnpm --filter portal test     # Portal unit tests
pnpm test -- <path/to/file.test.ts>  # Run specific test file
pnpm test:e2e                 # Playwright E2E (:3000)
pnpm test:a11y                # Storybook accessibility tests

# Database
pnpm --filter @repo/database db:types    # Regenerate Supabase types
pnpm db:seed                             # Seed dev database
pnpm --filter @repo/database supabase:start  # Start local Supabase
pnpm --filter @repo/database supabase:reset  # Reset local database

# Setup & Utilities
./setup.sh --dev       # One-command setup and launch development server
pnpm policy:check      # Architectural boundary enforcement
pnpm audit:compliance  # Run all audit gates
pnpm context:pack      # Create workspace bundle for analysis
```

## High-Level Architecture

This is a Turborepo monorepo using pnpm workspaces with these key areas:

- **`apps/portal`** — Next.js 16 App Router (React 19) with Turbopack, serves as the main mining operations portal
- **`packages/`** — Shared infrastructure:
  - `@repo/contract` — Zod schemas (Single Source of Truth for data validation)
  - `@repo/supabase` — Supabase clients and Kysely query builders
  - `@repo/database` — SQL migrations and schema (source of truth)
  - `@repo/theme` — Design tokens, OKLCH color system, Tailwind config
  - `@repo/ui` — Pure presentational components (Radix UI/shadcn/ui)
  - `@repo/utils` — Third-party integrations (Novu, Inngest, Excel)
  - `@repo/agents` — Shared agent coordination engine
  - `@repo/redis` — Redis client and caching helpers
- **`libs/`** — Domain-specific features:
  - `libs/features/*` — Feature modules with UI and data-access layers
  - `libs/shared/*` — Cross-cutting utilities, hooks, and data-access

## Critical Conventions & Boundaries

- **Package Manager**: pnpm exclusively (v9.15.9 pinned)
- **Light Mode Only**: Strict light mode (#f3f4f6); semantic OKLCH tokens from `@repo/theme`; no `dark:` variants
- **Architectural Boundaries** (enforced by policy compiler):
  - `apps/*` MUST NOT import `packages/database` directly — route via `@repo/supabase`
  - `packages/ui` must remain pure presentational (zero business logic)
  - No imports from `apps/*` into `packages/*` or `tools/*`
  - All primary data fetching in RSC / Server Actions / Handlers — never in `'use client'`
- **Server Actions**: Authenticate → authorize → validate via `@repo/contract` → rate-limit → invalidate cache → `redirect()`
- **Caching**: Next.js 16 cache components require named `cacheLife()` profile; mutations must invalidate tags
- **Client State**: `@tanstack/react-query` SSoT; SWR is prohibited
- **Commits**: Conventional commits via Husky/Commitlint; one commit per task
- **Secrets**: Never print, edit, or commit `.env*` secrets
- **Type Safety**: Strict TypeScript throughout; never use `any` or `@ts-ignore`

## Mandatory Verification Protocol (6-Pillar)

Before declaring any task complete, execute this protocol:

1. **Zero-Exception Verification**: Run `pnpm agent:verify` and self-heal any failures
2. **Dynamic Context Leasing**: Lease skills via `skills-mcp` (`acquire_skill`/`return_skill`)
3. **Structured Thinking (STM-0)**: Follow 5-phase protocol (Comprehension→Evidence→Solution→Criticism→Execution)
4. **Scoped Progression**: Decompose large objectives into atomic tasks before multi-package mutations
5. **AST Exploration**: Use `codemap`/`code-index`/`ast-grep` instead of catting large files
6. **Continuous Auditing**: Run corresponding domain audits (e.g., `pnpm audit:routing` for route changes)

## Troubleshooting

- If `pnpm` hangs: kill it and use `make` targets (`make dev`, `make build`, `make test`) or direct `turbo`/`node`
- For local network access: server binds to `0.0.0.0:3000` accessible via `<YOUR_LOCAL_IP>:3000`
- Environment setup: `./setup.sh` handles dependency installation and `.env` configuration from templates
