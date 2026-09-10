---
title: Monorepo Architecture & Turborepo Structure
created: 2026-06-03
updated: 2026-09-10
type: concept
tags: [architecture, pattern, system, build, turborepo]
sources: [turbo.json, package.json, pnpm-workspace.yaml]
confidence: high
---

# Monorepo Architecture & Turborepo Structure

Arch-Systems uses **Turborepo 2.x** with **pnpm 9.15.9** workspaces to manage and orchestrate the multi-package monorepo.

## Workspace Layout

The directory structure is organized into applications (`apps/`), shared library packages (`packages/`), and feature modules (`libs/`):

```
apps/
  portal/             → Next.js 16 app (App Router, React 19, port 3000)
  overview/           → Standalone Next.js app for architecture viz (React 18, port 3002)
  cms/                → Payload CMS v3 (headless, Postgres-backed)

packages/
  theme/              → @repo/theme — design tokens, CSS variables, Tailwind preset (Style Dictionary token pipeline)
  ui/                 → @repo/ui — shared components, Radix/shadcn UI primitives
  supabase/           → @repo/supabase — client wrappers (browser, server, middleware, read replicas) & generated database types
  database/           → @repo/database — SQL migrations (source of truth)
  hooks/              → @repo/hooks — useLocalStorage, useDebounce, etc.
  utils/              → @repo/utils — cn(), formatDate(), getCurrentShift(), excel utilities
  eslint-config/      → @repo/eslint-config — shared ESLint configurations
  typescript-config/  → @repo/typescript-config — shared tsconfig templates
  rate-limiter/       → @repo/rate-limiter — Redis & memory-based rate limiting strategies
  errors/             → @repo/errors — standardized error handling classes
```

## Task Orchestration (Turborepo Pipelines)

Turborepo task pipelines and cache keys are configured in [turbo.json](../../../turbo.json). Tasks run in parallel, resolving dependencies in topological order.

### Target Pipelines

- **build**: Depends on parent package builds (`^build`), code generation (`^codegen`, `codegen`).
  - Cache inputs: All project files except test, spec, and story files (`$TURBO_DEFAULT$`).
  - Cache outputs: `dist/**` and `.next/**` (excluding Next.js build cache).
- **codegen**: Generates tokens and theme assets from `variables.css`.
  - Cache outputs: `src/tokens/generated.ts`, `src/css/index.css`.
- **type-check**: Compiles TypeScript files across packages.
  - Cache outputs: TypeScript build info (`**/*.tsbuildinfo`).
- **lint / lint:css / lint:tokens**: Run ESLint (with `eslint-plugin-boundaries`), Stylelint, and token validation respectively, caching results.
- **test**: Runs unit tests (Jest/jsdom).
  - Cache outputs: `coverage/**`.

### Environment and Global Inputs

Turborepo tracks global workspace files (`tsconfig.json`, `pnpm-workspace.yaml`, `.npmrc`) and environment variables (`NODE_ENV`, `VERCEL_ENV`, `CI`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `INNGEST_EVENT_KEY`, `NOVU_API_KEY`, etc.) as part of the cache-invalidation signature.

## Architectural Boundaries

Enforced via `eslint-plugin-boundaries` generated dynamically from `tools/policy-compiler.cjs`.
Verification gate: `pnpm policy:check`.

## Commands

Task execution utilizes `turbo run`:

- `pnpm dev` → Starts the Next.js development server (runs `scripts/dev.sh` to initialize necessary resources)
- `pnpm build` → Builds all applications and packages via `turbo run build`
- `pnpm lint` → Lints the codebase via `turbo run lint`
- `pnpm type-check` → Type-checks all packages via `turbo run type-check`
- `pnpm test` → Runs unit tests via `turbo run test`
- `pnpm quality` → Runs the complete quality check gate:
  `turbo run lint type-check test lint:tokens lint:css && pnpm lint:root && pnpm lint:styles && pnpm lint:css-perf && pnpm lint:spelling && pnpm format:check && pnpm deps:lint && pnpm knip && pnpm policy:check && pnpm audit:compliance && pnpm html:check`

## Related

- [[arch-systems]] — The main product using this structure
- [[design-system]] — `@repo/theme` and styling conventions
- [[supabase-local-dev]] — Database and auth in the monorepo
- [[adr-011-turborepo-monorepo]] — ADR introducing Turborepo and Boundaries Plugin
