# Arch-System Baseline Audit

## Architecture Overview
The repository is a Turborepo monorepo using `pnpm`. It consists of:
- `apps/portal`: The main Next.js application.
- `packages/*`: Shared internal packages for the UI (`@repo/ui`, `@repo/theme`), database/Supabase (`@repo/supabase`, `@repo/database`), and utilities (`@repo/utils`, `@repo/errors`, `@repo/rate-limiter`, `@repo/logger`, `@repo/redis`, `@repo/agents`, `@repo/eval`, `@repo/contract`).

## Data Flow
The Next.js app communicates with Supabase (PostgreSQL) using clients from `@repo/supabase`. Data contracts and schemas are defined in `@repo/contract`. Real-time subscriptions and database interactions rely heavily on these clients. State management involves React Query and Zustand.

## UX Baseline
The application utilizes Radix UI and shadcn/ui components within `@repo/ui`, consuming design tokens from `@repo/theme`. Multiple department dashboards are structured with shared layouts (e.g., GlassCard, KPI components).

## Security Baseline
Authentication and authorization use Supabase. Row-Level Security (RLS) is heavily employed. Next.js server actions and API routes likely validate inputs using Zod schemas from `@repo/contract`.

## Quality/Test Baseline
The project uses `biome` for linting, `tsc` for type-checking, `jest` for unit testing, and `playwright` for end-to-end testing. A `pnpm quality` script acts as a comprehensive quality gate.
