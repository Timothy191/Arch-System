# Arch-System Folder Groupings & Module Guide

This repository contains applications and packages mapped as follows:

## Groupings & Paths

- **`/apps`**: Main runnable user-facing interfaces and content management systems.
  - `portal` - Next.js 16 Operations Portal (Port :3000)
  - `cms` - Payload CMS v3 headless service (Port :3001)
  - `overview` - React Flow architectural visualization (Port :3002)

- **`/packages`**: Reusable modules, database tooling, and configuration presets shared across applications.
  - `@repo/theme` - Design tokens and Generated CSS
  - `@repo/ui` - Shared Radix UI & shadcn components
  - `@repo/supabase` - Client wrappers & types mapping
  - `@repo/database` - Migrations and SQL SSoT
  - `@repo/redis` - Key-value stores and slug resolving
  - `@repo/utils` - Integration utilities (Inngest, Novu)
  - `@repo/errors` - Custom domain errors
  - `@repo/rate-limiter` - Rate limits
  - `@repo/logger` - Logging framework
  - `@repo/eval` - DeepEval AI tests
  - `@repo/contract` - Schema contracts
  - `@repo/agents` - Orchestration helpers

## Target Execution

When running operations, prefer targeting specific projects/packages to avoid full-monorepo rebuild overhead:

- Build: `npx nx build <project>`
- Test: `npx nx test <project>`
- Lint: `npx nx lint <project>`
