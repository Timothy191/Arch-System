# Arch-System/ (Plantcor Industrial Operations Portal)

## Responsibility

Multi-departmental industrial mining operations portal monorepo (Nx 22 + pnpm workspaces) serving high-vigilance dashboards for drilling, production, engineering, access control, badging, and SCADA control room operations.

## Design

- **Unified Frontend**: Single Next.js 16 App Router application (`apps/portal` on `:3000`) with Turbopack, React 19, and Tailwind OKLCH design system.
- **Data & Auth Security**: PostgreSQL with strict Row-Level Security (RLS) enforcing `auth.uid()` and employee department array authorization (`public.employees.accessible_departments`).
- **Low-Latency Caching**: Write-through Redis L1/L2 session and profile cache (`@repo/redis`) to eliminate database query overhead on edge middleware transitions.
- **Single Source of Truth**: Canonical Zod schemas and derived TypeScript contracts defined in `@repo/contract`.

## Flow

1. **Edge Middleware Routing**: Inbound requests hit `apps/portal/proxy.ts` delegating to `apps/portal/server/proxy.ts`, validating session tokens against Redis cache (`arch:auth:employee:${user.id}`).
2. **Server Actions & Mutation Flow**: Authenticated Server Actions invoke `createServerSupabaseClient()`, validate Zod input contracts, and return typed results (`{ success, data, error }`).
3. **Real-Time CDC Ingestion**: Supabase Realtime WebSocket channels broadcast Postgres change data capture events to client TanStack Query caches with sub-second UI updates.

## Integration

- `apps/portal`: Industrial web application with `/hub`, `/overview` (React Flow visualizer), and department directories.
- `libs/features/*`: Domain modules (`auth/ui`, `departments/ui`, `departments/data-access`, `hub/ui`).
- `packages/*`: Shared `@repo/*` packages (contract, supabase, redis, database, errors, rate-limiter, theme, ui, logger, utils, agents, eval).
- `infra/*`: Docker compose and Kubernetes topologies for local Supabase, Redis, and metrics stack (Prometheus, Grafana).
