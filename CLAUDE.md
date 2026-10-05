# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

Always run these commands from the `Arch-System/` directory:

### Development

```bash
pnpm dev              # Full dev system (binds 0.0.0.0:3000)
pnpm dev:quick        # Headless quick boot (no Docker)
pnpm dev:turbo        # Portal dev via Turborepo
```

### Build & Quality

```bash
pnpm build            # Full Turborepo build
pnpm type-check       # TypeScript check across workspace
pnpm lint             # Linting (Biome in portal)
pnpm quality          # Full quality gate (lint, type-check, test, tokens, CSS, etc.)
```

### Testing

```bash
pnpm test                     # All unit tests
pnpm --filter portal test     # Portal unit tests only
pnpm --filter portal test -- --testPathPattern="<name>"  # Single test file
pnpm test:e2e                 # Playwright E2E (requires portal on :3000)
pnpm test:a11y                # Storybook accessibility tests
```

### Database

```bash
pnpm --filter @repo/database db:types    # Regenerate Supabase types
pnpm db:seed                             # Seed cloud dev database
pnpm --filter @repo/supabase supabase:start  # Start local Supabase
pnpm --filter @repo/supabase supabase:reset  # Reset local database
```

### Agent Verification (MANDATORY)

```bash
pnpm agent:verify     # Must exit 0 before completing any task
pnpm audit:browser    # Closed-loop browser, devtools & accessibility probe (frontend tasks)
```

## High-Level Architecture

### Monorepo Structure

- **`apps/portal`** — Next.js 16 App Router (main application)
- **`packages/*`** — Foundational packages: `@repo/contract` (Zod SSoT), `@repo/supabase` (clients + Kysely), `@repo/database` (migrations), `@repo/redis` (L1/L2 cache), `@repo/theme`, `@repo/ui`, `@repo/utils`
- **`libs/features/*`** — Domain feature slices (`auth`, `departments`, `hub`)
- **`libs/shared/*`** — Cross-cutting utilities (`data-access`, `hooks`)
- **`tools/`** — Build-time governance (policy compiler, audit suites)

### Key Boundaries (ENFORCED)

- `apps/*` must NOT import `packages/database` directly — use `@repo/supabase`
- `packages/ui` must remain pure presentational (no logic)
- `packages/*` and `tools/*` must NOT import `apps/*`
- All data fetching must happen in Server Components/RSC/Route Handlers — never in `'use client'` components

### Critical Conventions

- **Package Manager**: Use `pnpm` exclusively (v9.15.9 pinned)
- **Light Mode Only**: No dark mode variants; use semantic OKLCH tokens from `@repo/theme`
- **File Length**: Target 400-450 lines, hard ceiling 500 lines
- **Server Actions**: Must authenticate, authorize, validate via `@repo/contract`, rate-limit, and invalidate cache before `redirect()`
- **Caching**: Requires named `cacheLife()` profile; mutations invalidate tags
- **React Query**: `@tanstack/react-query` only — SWR prohibited
- **Testing**: Jest 30 SSoT — no other test runners

### Critical Gotchas

- Always scope commands per project (pnpm/turbo commands run from `Arch-System/`)
- `.env` files contain secrets — never print, edit, or commit them
- Sibling paths are hardcoded in federated audit — renaming `arch-system-nest-proxy/`, `redis/`, or `n8n-vercel/` breaks audit
- If `pnpm` hangs with no output, kill it and use `make` targets (`make dev`, `make build`, `make test`) or invoke `turbo`/`node` directly

## Verification Requirements

Before completing ANY task:

1. Run `pnpm agent:verify` — must exit 0
2. For frontend tasks: run `pnpm audit:browser` — must exit 0
3. Follow STM-0 5-phase structured thinking mandate (see `.agents/rules/structured-thinking-mandate.md`)
4. No force-push, history rewrite, or branch deletion
5. No new runtime dependencies without approval
6. No edits to secrets, credentials, or key material

## Agent Governance

- All behavioral rules, operational guides, skills, and governance are consolidated in `.agents/`
- Read `.agents/GUIDE.md` for operational reference
- Read `AGENTS.md` for architecture, domain, personas, data flow, and invariants
- Provider-specific settings (e.g., `.claude/settings.json`) remain at their required locations but contain no behavioral rules
