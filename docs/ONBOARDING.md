# Developer Onboarding Guide

Welcome to the Arch-Systems (Plantcor) project! This guide will help you set up, validate your workspace environment, and start contributing to our Nx monorepo.

---

## 1. Prerequisites & Toolchain

Ensure your local machine satisfies the monorepo engine requirements:

- **Node.js**: `>=22` (Pinned via Volta to `24.15.0`)
- **pnpm**: `9.15.9` (Enforced via `packageManager` field)
- **Docker & Docker Compose**: Required for local Supabase database and E2E visual suites.
- **Git & SSH**: Configured with proper commit signing and repository access.

---

## 2. Quick Setup (Time-to-First-Commit < 15 mins)

Clone the repository and run the setup sequence:

```bash
git clone git@github.com:arch-systems/portal.git
cd Arch-System

# 1. Install dependencies across all Nx workspace projects
pnpm install

# 2. Provision environment configuration
cp apps/portal/env/.env.example apps/portal/.env

# 3. Run the automated workspace diagnostic suite
pnpm onboard
```

The `pnpm onboard` diagnostic suite checks:
1. Node engine & Volta toolchain compatibility.
2. pnpm workspace catalog integrity.
3. Docker & local Supabase container health.
4. `.env` variable key alignment against templates.
5. ESLint architecture policy boundaries (SSoT).
6. Sub-second feature hook test sanity.

---

## 3. Local Infrastructure & Development Stack

We use Supabase for PostgreSQL, Auth, and Row-Level Security (RLS).

```bash
# Start local Supabase containers (DB on :54322, Studio on :54323, API on :54321)
pnpm --filter @repo/database supabase:dev

# Launch Next.js 16 Portal with Turbopack dev server (:3000)
pnpm dev
```

> **Fast-Boot Alternative**: Run `pnpm dev:quick` for headless / background dev execution.

---

## 4. Understanding Monorepo Architecture

Before making changes, inspect the interactive dependency graph to understand module boundaries and blast radius:

```bash
# Launch interactive graph visualizer
pnpm nx:graph

# View affected projects based on your local branch diff
pnpm dev:graph
```

### Key Architectural Boundaries
- `apps/portal`: Next.js 16 App Router interface (must not import DB internals directly).
- `packages/contract`: Canonical Zod schemas and entity definitions (Single Source of Truth).
- `libs/features/*`: Domain-specific UI and data-access modules (`scope:feature`).
- `packages/theme`: OKLCH design tokens (Light mode only; dark mode is unsupported).

---

## 5. Development Workflow & Quality Gates

### A. Sub-Second Inner-Loop Feedback
Do not wait for the entire monorepo test suite on every change. Use targeted test runners:

```bash
# Instant sub-second test execution for active hooks/components
pnpm --filter portal test -- --testPathPatterns="<hook-or-component-name>"
```

### B. Pre-Commit Quality Gate
Before opening a PR or merging, execute the complete quality suite:

```bash
# Runs ESLint, TypeScript check, unit tests, token linting, dead code scan, and policy checks
pnpm quality

# Verify database migration rollback safety & contract compliance
pnpm audit:compliance
```

---

## 6. Required Reading & Agentic Context

- **[CLAUDE.md](../CLAUDE.md)**: Monorepo conventions, common commands, and heuristics.
- **[AGENTS.md](../AGENTS.md)**: Agentic workflow contracts, AI hierarchy, and `AGENT_TRACER.md` logging requirements.
- **[DESIGN.md](../DESIGN.md)**: Design system tokens, OKLCH palette, and motion rules.
- **[SECURITY.md](../SECURITY.md)**: Row-Level Security (RLS) policies and security audit scripts.

---

## 7. Your First Contribution

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Implement your changes within the appropriate domain (`libs/features/` or `apps/portal`).
3. **Update `AGENT_TRACER.md`** in the modified package with a timestamp and handover summary.
4. Run `pnpm onboard` and `pnpm quality`.
5. Submit your Pull Request. CI will run verification and deploy preview environments.

Welcome aboard! 🚀
