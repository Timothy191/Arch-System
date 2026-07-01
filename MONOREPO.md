# Monorepo Guide

Welcome to the Arch-Systems monorepo. This document outlines the structure, tools, and scripts used across the workspace.

## Structure

- `apps/`: Next.js frontend (`portal`), CMS backend (`cms`), and React Flow architecture visualizer (`overview`).
- `pkgs/`: Shared libraries such as `@repo/ui`, `@repo/theme`, `@repo/database`, and `@repo/supabase`.
- `tools/`: Build, analysis, and audit scripts (`policy-compiler.cjs`, `design-audit.cjs`, `enforce-security-checks.cjs`).
- `ops/`: Local dev and deployment utility scripts (e.g. `sync-assets-smart.cjs`, `ensure_reachability.py`).

## Nx Targets

The workspace is managed by [Nx](https://nx.dev/). Important targets configured in `nx.json`:

- `build`: Builds the project and its dependencies. Cacheable.
- `test`: Runs the Jest/Vitest unit tests. Cacheable.
- `lint`: Runs ESLint with boundary rules enforced by `tools/policy-compiler.cjs`. Cacheable.
- `type-check`: Runs the TypeScript compiler without emitting files. Cacheable.
- `lint:tokens`: Validates design system tokens in `@repo/theme`. Cacheable.
- `lint:css`: Lints CSS against Stylelint. Cacheable.
- `codegen`: Generates design system tokens and Supabase database types.
- `db:pull`: Pulls remote database schema changes into local migration files (not cached).

## Security & Policies

We use static analysis tools to maintain quality and security boundaries:

- **Policy Compiler** (`pnpm policy:check`): Ensures boundaries (e.g., UI packages cannot import Database packages).
- **Security Check** (`pnpm policy:security`): Enforces patterns against `eval`, string-concatenated SQL queries, and hardcoded secrets.
- **RLS Audit** (`pnpm audit:rls`): Checks PostgreSQL migration files for correct Row-Level Security application.
- **Design Audit** (`pnpm audit:design`): Checks for visual style compliance, ensuring the "Light Theme" constraint and usage of OKLCH shadow tokens.

## E2E Testing

Playwright tests are located in `e2e/`.
The test suite utilizes a global authentication setup (`e2e/global.setup.ts`) configured via `playwright.config.ts`, which provisions an authenticated state reused across chromium, mobile, and tablet tests.
