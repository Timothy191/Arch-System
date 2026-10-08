# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in `Arch-System`.

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
pnpm test:e2e                 # Playwright E2E (:3000)
pnpm test:a11y                # Storybook accessibility tests

# Database
pnpm --filter @repo/database db:types    # Regenerate Supabase types
pnpm db:seed                             # Seed dev database
pnpm --filter @repo/database supabase:start  # Start local Supabase
pnpm --filter @repo/database supabase:reset  # Reset local database
```

## Anti-Bloat Context Management (`skills-mcp`, `slim-tooling-mcp`)

- **Never inject raw manuals or rules into prompt context.**
- Lease skills dynamically via `skills-mcp` (`acquire_skill`) and release immediately via `return_skill(name, agentId, status)`.
- Lease architectural slices via `acquire_context(id, agentId)` and free via `release_context`.
- Query memory & retrospectives via `memory-gateway-mcp` (`search_unified_memory`).
- Route external MCP tool calls virtually through `slim-tooling-mcp` (`call_upstream_tool`) instead of preloading raw schemas.

## High-Level Architecture & Boundaries

- **`apps/portal`** — Next.js 16 App Router (RSC-first).
- **`packages/*`** — `@repo/contract` (Zod SSoT), `@repo/supabase` (data layer), `@repo/database` (migrations), `@repo/redis` (L1/L2), `@repo/theme`, `@repo/ui` (pure presentational), `@repo/utils`.
- **`libs/features/*`** & **`libs/shared/*`** — Domain feature slices and cross-cutting hooks/utilities.

### Strict Enforced Boundaries

- `apps/*` MUST NOT import `packages/database` directly — route via `@repo/supabase`.
- `packages/ui` must remain pure presentational (zero business logic).
- No imports from `apps/*` into `packages/*` or `tools/*`.
- All primary data fetching in RSC / Server Actions / Handlers — never in `'use client'`.
- Parallelize independent queries (`Promise.allSettled`), memoize with `React.cache()`.

## Critical Conventions

- **Package Manager**: `pnpm` exclusively (pinned v9.15.9).
- **Light Mode Only**: Strict light mode (#f3f4f6 background); semantic OKLCH tokens from `@repo/theme`. Never `dark:` variants.
- **Server Actions**: Authenticate on first line, authorize, validate via `@repo/contract`, rate-limit, and invalidate cache before `redirect()`.
- **Caching**: Next.js 16 cache components (`'use cache'` requires named `cacheLife()` profile). Mutations must invalidate tags.
- **Client State**: `@tanstack/react-query` SSoT. SWR is prohibited.
- **Commits**: Conventional commits via Husky/Commitlint. One commit per task; no force-push.
- **Secrets**: Never print, edit, or commit `.env*` secrets.
- **Troubleshooting**: If `pnpm` hangs with no output, kill it and use `make` targets (`make dev`, `make build`, `make test`) or direct `turbo`/`node`.

## Verification Mandate (6-Pillar Protocol)

Before completing ANY task, execute and satisfy the 6-pillar protocol ([`.agents/rules/agent-accuracy-enforcement.md`](file:///home/tim/Fork/Arch-System/.agents/rules/agent-accuracy-enforcement.md)):

1. **Zero-Exception Verification**: Run `pnpm agent:verify` — must achieve 100% PASS (0 exit code). Autonomously self-heal any failures.
2. **Dynamic Context Leasing**: Pull skills dynamically via `skills-mcp` (`acquire_skill`) and free immediately via `return_skill()`. Route external tools via `slim-tooling-mcp`.
3. **Structured Thinking (STM-0)**: Follow the 5 phases (Comprehension → Evidence → Solution → Criticism → Execution) defined in [`.agents/rules/structured-thinking-mandate.md`](file:///home/tim/Fork/Arch-System/.agents/rules/structured-thinking-mandate.md). Complete 100% of TODOs.
4. **Scoped Progression**: Decompose large objectives into smaller atomic tasks to understand conventions before mutating code.
5. **AST Exploration**: Explore code via `codemap`, `code-index`, or `ast-grep` rather than dumping files into context.
6. **Continuous Invariant Auditing**: Continuously run the corresponding domain audit (`pnpm policy:check`, `pnpm audit:tokens`, `pnpm audit:routing`, `pnpm audit:caching`, `pnpm audit:vercel`, etc.). For UI changes, execute `pnpm audit:browser`. Operational reference lives in [`.agents/GUIDE.md`](file:///home/tim/Fork/Arch-System/.agents/GUIDE.md) and [`AGENTS.md`](file:///home/tim/Fork/Arch-System/AGENTS.md).
