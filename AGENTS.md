# Arch-System (Plantcor OS) — Agent Entry Point

> **Single Source of Truth, condensed.** This file is the always-loaded entry point.
> Antigravity truncates rule files at **24,000 bytes**; the previous version of this
> file was 51,679 bytes and lost its tail on **every single request** (1,339 logged
> truncation events, 26.4 MB discarded). Deep detail now lives in the linked
> reference files, loaded only when relevant.

**Project**: enterprise industrial surface-mining operations platform. Coordinates
SCADA telemetry, pit extraction tracking, drill/bit-depth telemetry, mobile equipment
maintenance, contractor badging/access control, and atomic shift closeout across
mining sites (Brakfontein + extensions).

Built for harsh field conditions: vibration, dust, audio noise, intermittent
satellite connectivity ("lie-fi"), 24/7 operation. Enforces auditability,
immutable ledger logs, offline resilience, and strict light-mode OKLCH design on
field terminals over LAN (`0.0.0.0:3000`).

## Personas

| Persona                       | Focus                                                                                                                           |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| Control Room Operators        | Real-time shift monitoring, hourly production loads grid, SCADA telemetry, atomic shift closeout                                |
| Engineering & Breakdown Crews | Mobile equipment breakdown logging, maintenance work orders, SMR (Service Meter Reading) hour tracking, tire life wear analysis |
| Access Control & Security     | Personnel badging, contractor/visitor inductions, RFID coal truck tracking, hardware badge printing                             |
| Supervisors & Executives      | Shift compilation reports, multi-site production summaries, automated audit compliance, SLA tracking                            |

---

## Reference Files (load on demand)

| File                                                       | Contents                                                                                                                                           |
| :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/agents/architecture.md](docs/agents/architecture.md) | Full data-flow diagrams, monorepo boundary invariants, key modules, end-to-end data flow, key-directory table                                      |
| [docs/agents/commands.md](docs/agents/commands.md)         | Every `pnpm` command: dev, build, quality gates, policy, database, testing, coverage                                                               |
| [docs/agents/invariants.md](docs/agents/invariants.md)     | All 14 hard invariants in full (light mode, next/image, data fetching, caching, Turbopack, RSC, Taint, query SSoT, hooks, deploy preflight, tests) |
| [docs/agents/personas.md](docs/agents/personas.md)         | 7 subagent persona definitions with operational "souls", `.agents/` governance tree, 7 mining departments                                          |
| [docs/agents/patterns.md](docs/agents/patterns.md)         | Code conventions, error hierarchy, Server Action template, DI factories, state management, file-length limits, key files table                     |

---

## Non-Negotiable Invariants (always enforce)

These are the highest-risk rules — they are duplicated here so truncation never
loses them. Full text with rationale and examples: `docs/agents/invariants.md`.

1. **Monorepo boundaries** — `apps/*` MUST NOT import `packages/database` (route via
   `@repo/supabase`); `packages/ui` MUST stay pure presentational; `packages/theme`
   MUST NOT import `packages/ui`; no `packages/*` or `tools/*` → `apps/*`.
   Enforced by `tools/repo/policy-compiler.cjs`. Gate: `pnpm policy:check`.
2. **Strict light mode** — NEVER write `dark:` Tailwind variants or dark-mode toggles.
   All color/radius/glass must use semantic OKLCH tokens from `@repo/theme/src/tokens/`.
   Raw hex/rgb is forbidden. Gate: `pnpm audit:tokens`.
3. **next/image only** — NEVER raw `<img>` in app routes (only root `error.tsx`).
   `<Image>` requires explicit `width`/`height` or `fill` + positioned parent, plus a
   descriptive `alt`. `priority` only on the single LCP hero. Gate: `pnpm audit:images`.
4. **No DB from Client Components** — all primary queries run in RSC / Server Actions /
   Route Handlers. NEVER query `@repo/supabase/server` from `'use client'`.
   Parallelize independent queries (`Promise.allSettled`), memoize shared lookups with
   `React.cache()`. Gate: `pnpm audit:data-fetching`.
5. **Caching discipline** — Next.js 16 `cacheComponents` + L1/L2 Redis. `'use cache'`
   REQUIRES a named `cacheLife()` profile; never call `cookies()`/`headers()` inside a
   `'use cache'` scope; every mutation invalidates tags. Gate: `pnpm audit:caching`.
6. **Turbopack** — never `{ ssr: false }` in a Server Component; never
   `/* webpackOptional: true */` (use `turbopackOptional`); never sync-import heavy
   libs in root layouts. Client chunk budget ≤ 1.0 MB. Gate: `pnpm audit:turbopack`.
7. **Server Action safety** — every action authenticates, authorizes, validates via
   `@repo/contract`, rate-limits, and invalidates cache **before** `redirect()`.
   Never `route.ts` + `page.tsx` in the same segment. Gate: `pnpm audit:routing`.
8. **React 19 boundaries** — props crossing the RSC boundary must be serializable.
   Never `createContext()`/hooks in a Server Component. Never `"use server"` on a
   component returning JSX. Guard secrets with Taint APIs. Gate: `pnpm audit:rsc`.
9. **React Query SSoT** — `@tanstack/react-query` only. SWR (`vercel/swr`) is
   **prohibited**. Never hand-roll polling when Supabase Realtime CDC exists.
   Gate: `pnpm audit:hooks`.
10. **Jest 30 SSoT** — one unit-test runner. Never introduce `ava`/`mocha`/`tape`.
    Never weaken or delete assertions to silence a warning. Gate: `pnpm audit:hooks`.
11. **Shell safety** — never destructive bash (`rm -rf /`, `dd`, `chmod 777`, raw block
    device writes, pipe-to-shell). Audited by `tools/scripts/check-compound-bash.cjs`.

---

## Stack & Runtime

- **Monorepo**: pnpm workspaces + Turborepo 2.x. `pnpm` **9.15.9** pinned (hard).
  Never `bun`/`npm`/`yarn`. Catalogs in `pnpm-workspace.yaml` (`catalog:react19`).
- **Node**: `>=22`, pinned `24.15.0`. **Portal**: Next.js 16 (React 19) App Router,
  standalone output, Turbopack.
- **DB**: PostgreSQL 15+ via Supabase, RLS on every table, sequential migrations
  in `packages/database/migrations/` (`NNN_description.sql`, 126 active files
  through version 175; `packages/supabase/migrations` is a symlink),
  atomic RPCs (e.g. `atomic_shift_closeout`).
- **Quality**: Biome (2-space, 100 col, single quotes, semicolons, ES5 trailing commas),
  Stylelint (OKLCH), Jest 30 + `@swc/jest`, Playwright E2E, DeepEval (Python ≥3.10),
  Storybook + axe, k6, Conventional Commits via Husky/Commitlint.
- **Other runtimes**: Python ≥3.10 (eval), Rust/Cargo (swarms orchestrator), Docker
  Compose (`infra/docker/`; production Redis needs `REDIS_PASSWORD`).
- **Coverage floors**: statements 40%, branches 30%, functions 30%, lines 40%.
  Strategic target: Server Actions, RLS helpers, Auth, AI failovers → 90%+.

## Daily Commands

```bash
pnpm dev            # full dev system (binds 0.0.0.0:3000)
pnpm build          # Turborepo build of all packages
pnpm quality        # full quality gate: lint, typecheck, test, tokens, CSS, knip, policy
pnpm test           # unit/integration (Jest 30 via Turborepo)
pnpm test:e2e       # Playwright E2E (server must be on :3000)
pnpm policy:check   # architectural boundary enforcement
pnpm audit:compliance  # all audit:* gates
```

Full command reference: `docs/agents/commands.md`.

---

## Governance Entry Points

- **`AGENTS.md`** (this file) — primary SSoT, condensed.
- **`CLAUDE.md`** — thin redirect → `.agents/GUIDE.md` + `.agents/rules/`.
- **`GEMINI.md`** — Gemini/Antigravity guide → `.agents/GUIDE.md`.
- **`.cursorrules`** — Cursor redirect → `.agents/GUIDE.md`.
- **`skills-mcp`** — Anti-bloat registry for 60+ dynamic skills, scoped context slices, and 40+ personas.
- **`memory-gateway-mcp`** — Federated multi-tier memory gateway bridging retrospectives, swarm SQLite, and session remember logs.
- **`slim-tooling-mcp`** — Virtual tool proxy middleman preventing tool definition bloat across MCP servers.
- **`codemap`** — TypeScript/Rust/CSS AST structural intelligence (SQLite symbols, imports, AST call graph, token recipes).
- **`code-index`** — Sub-millisecond Rust AST multi-language code indexer & daemon (symbol search, caller/callee graphs, FTS).
- **`aegntic-mcp`** — Multi-layer RAG knowledge engine with web crawling, knowledge graphs (27+ entities, 40+ relationships), and task management.
- **`appsai-mcp-server`** — Full-stack React/Next.js project integration with AWS + MongoDB backend connectivity.
- **`hyperbrowser-mcp`** — Cloud browser automation, web scraping, and content extraction via @hyperbrowser/sdk.
- **`coding-tools-mcp`** — Workspace-confined coding primitives: patch application, command execution, Git operations, and workspace inspection.
- **`agentic-tools-mcp`** — Advanced task management with unlimited hierarchy + agent memories with JSON file storage.
- **`.agents/`** — 17 permanent rules (incl. STM-0 structured thinking), 40+ subagent
  personas, 60+ skills, lifecycle hooks, A2A protocol, CorpOS business loops.

## Mandatory Protocol

Before any code mutation, follow the **STM-0 5-phase structured thinking mandate**
(`.agents/rules/structured-thinking-mandate.md`). Complete 100% of listed TODOs and
report in detail per `.agents/rules/todo-completion-and-detailed-reporting.md`.
Use `skills-mcp` to lease skills/context on-demand and release them immediately upon task completion to prevent token bloat. Route external MCP tools via `slim-tooling-mcp` on-demand rather than preloading full toolsets into prompt memory.
For codebase exploration and refactoring, query `codemap` and `code-index` rather than catting large files into prompt context. Ensure `code-index` daemon and `codemap` watchers remain running in background. Autonomous tool shopping is executed via `clihub-ai` / `mise` / `cargo` / `uv`.

**Version control**: use plain `git` by default. GitButler (`but`) is the intended workflow, but it is **not initialized in this repo** — `but` fails with _"No GitButler project found"_, and no `.gitbutler/` config exists. Initializing it (`but setup`) mutates the global GitButler registry and adds a `gb-local` remote, so it is a human decision, not an autonomous one. Until someone runs `but setup`, plain `git` is the only working path. The current branch is `gitbutler/workspace` despite this.
