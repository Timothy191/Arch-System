# Tech Stack - Arch-Systems (Plantcor)

## Monorepo Architecture
- **Package Manager**: pnpm `9.15.9` (monorepo workspaces defined in `pnpm-workspace.yaml`)
- **Build System**: Turborepo (`turbo` 2.10.2) + Nx support
- **Runtime**: Node.js `>=22` (pinned to Volta `24.15.0`)
- **Primary Languages**: TypeScript 5.7, Modern JavaScript (ESM), SQL (PostgreSQL), Python (evals)

## Applications
- **`apps/portal`**: Operations Dashboard (Port 3000)
  - Next.js 16 (App Router, Turbopack, React 19)
  - Styling: Tailwind CSS with `@repo/theme` preset
  - UI Primitives: `@repo/ui` (shadcn-style Radix components)
  - Department Views: `drilling`, `production`, `access-control`, `engineering`, `control-room`, `safety`, `training`, `satellite-monitoring`
- **`apps/api`**: Operations Backend API (Port 3004)
  - NestJS 11 on Fastify 5
  - Swagger documentation at `/api/docs` (dev)
- **`apps/cms`**: Payload CMS v3 (Port 3001)
- **`apps/overview`**: Architecture & System Flow Viewer (Port 3002)

## Packages & Shared Libraries
- **`@repo/supabase`**: Data access layer (`@supabase/ssr`, Kysely typed queries, service role, read-replica)
- **`@repo/database`**: SQL migrations source of truth (apps never import directly)
- **`@repo/redis`**: Redis caching client & rate limiting utilities
- **`@repo/theme`**: OKLCH color palettes, typography tokens, Tailwind config
- **`@repo/ui`**: Shared reusable UI component library
- **`@repo/contract`**: Shared Zod schemas and validation contracts
- **`@repo/errors`**: Standardized application error hierarchy (`AppError`)
- **`@repo/eval`**: Python LLM evaluation suite

## Data Layer & Infrastructure
- **Database**: PostgreSQL with Supabase
  - Mandatory Row Level Security (RLS) on all tables
  - Schema migrations in `packages/database/migrations/`
- **Caching & State**: Redis (local Docker & managed cluster)
- **Infrastructure / Deployment**:
  - Docker Compose for local development & full-stack production containers
  - Self-hosted Linux & cloud services
