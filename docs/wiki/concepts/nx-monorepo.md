---
title: Nx Monorepo Structure
created: 2026-06-03
updated: 2026-06-03
type: concept
tags: [architecture, pattern, system, build]
sources: [nx.json, package.json, pnpm-workspace.yaml]
confidence: high
---

# Nx Monorepo Structure

Arch-Systems uses **Nx 22.7.5** with **pnpm 9.15.9** workspaces to manage and orchestrate the multi-package monorepo. This workspace was migrated from Turborepo to Nx to support a more stable testing environment, native task orchestration, and fine-grained target configurations.

## Workspace Layout

The directory structure is organized into applications (`apps/`) and shared library packages (`packages/`):

```
apps/
  portal/             → Next.js 15 app (App Router, React 19, port 3000)
  overview/           → Standalone Next.js app for architecture viz (React 18, port 3002)
  cms/                → Payload CMS v3 (headless, Postgres-backed)

packages/
  theme/              → @repo/theme — design tokens, CSS variables, Tailwind preset (Style Dictionary token pipeline)
  ui/                 → @repo/ui — shared components, Radix/shadcn UI primitives
  supabase/           → @repo/supabase — client wrappers (browser, server, middleware, read replicas) & generated database types
  database/           → @repo/database — SQL migrations (61 migrations, source of truth)
  hooks/              → @repo/hooks — useLocalStorage, useDebounce, etc.
  utils/              → @repo/utils — cn(), formatDate(), getCurrentShift(), excel utilities
  eslint-config/      → @repo/eslint-config — shared ESLint configurations
  typescript-config/  → @repo/typescript-config — shared tsconfig templates
  rate-limiter/       → @repo/rate-limiter — Redis & memory-based rate limiting strategies
  errors/             → @repo/errors — standardized error handling classes
```

## Task Orchestration (Nx Target Defaults)

Nx task pipelines and cache keys are configured in [nx.json](../../../nx.json). Tasks are run in parallel, resolving dependencies in topological order.

### Target Pipelines

- **build**: Depends on parent package builds (`^build`) and code generation (`^codegen`).
  - Cache inputs: All project files except test, spec, and story files.
  - Cache outputs: `dist/**` and `.next/**` (excluding Next.js build cache).
- **codegen**: Generates tokens and theme assets from `variables.css`.
  - Cache outputs: `{projectRoot}/src/tokens/generated.ts`.
- **type-check**: Compiles TypeScript files.
  - Cache outputs: TypeScript build info (`.tsbuildinfo`).
- **lint / lint:css / lint:tokens**: Run ESLint, Stylelint, and token validation respectively, caching their results.
- **test**: Runs unit tests (Jest/jsdom).
  - Cache outputs: `{projectRoot}/coverage/**/*`.

### Environment and Global Inputs

Nx tracks global workspace files (`turbo.json`, `tsconfig.json`, `pnpm-workspace.yaml`, `.npmrc`) and environment variables (`NODE_ENV`, `VERCEL_ENV`, `CI`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `INNGEST_EVENT_KEY`, `NOVU_API_KEY`, etc.) as part of the cache-invalidation signature.

## pnpm Workspace Catalogs

Shared dependency versions are centralized in [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) under catalogs, avoiding version drift:


- `catalog:` — shared general dependencies (framer-motion, tailwindcss, lucide-react, sonner, lenis, zustand, etc.)
- `catalogs:react19` — React 19 specific dependencies (`react`, `react-dom`, `@types/react`, etc.)

## Commands

Task execution utilizes `nx run-many`:

- `pnpm dev` → Starts the Next.js development server (runs `scripts/dev.sh` to initialize necessary resources)
- `pnpm build` → Builds all applications and packages via `nx run-many -t build`
- `pnpm lint` → Lints the codebase via `nx run-many -t lint`
- `pnpm test` → Runs unit tests via `nx run-many -t test`
- `pnpm quality` → Runs the complete quality check gate:
  `nx run-many -t lint type-check test lint:tokens lint:css && pnpm lint:root && pnpm format:check && pnpm deps:lint && pnpm knip`
- `pnpm format` → Formats files with Prettier
- `pnpm ui` → Installs/adds shadcn UI components into `@repo/ui`
- `pnpm --filter @repo/database supabase:dev` → Starts local Supabase Docker containers
- `pnpm deploy:local` → Deploys the stack locally with database migrations

## Related

- [[arch-systems]] — The main product using this structure
- [[design-system]] — `@repo/theme` and styling conventions
- [[supabase-local-dev]] — Database and auth in the monorepo
- [[adr-008-nx-monorepo]] — ADR introducing Nx to the project
