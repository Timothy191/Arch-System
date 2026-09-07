# Supabase Client Package (@repo/supabase) — Agent Guidelines

## Scope & Purpose

Infrastructure package providing Supabase SSR client factories (browser, server, middleware, service-role, read-replica), Kysely type-safe query builders, telemetry tracers, and database schema types for the PostgreSQL backend.

## Inner Loop Commands

- **Run all unit tests**: `pnpm nx test @repo/supabase`
- **Run targeted test spec**: `pnpm --filter @repo/supabase test -- -t "<specName>"`
- **Compile package**: `pnpm nx build @repo/supabase` _(compiles `./dist/`)_
- **Type-check package**: `pnpm nx type-check @repo/supabase`
- **Lint package**: `pnpm nx lint @repo/supabase`
- **Synchronize remote database types**: `supabase gen types typescript --project-id <ref> > src/database.types.ts`

## Architectural Invariants

- **Boundary Scope (`scope:package:supabase`)**:
  - Prohibited from importing presentation or UI layers (`@repo/ui`, `libs/features/*/ui`, `apps/*`).
  - Consumers must access database data through `@repo/supabase` client factories—direct raw DB drivers or unvetted queries are forbidden in application code.
- **Security & Authorization Invariants**:
  - **Service Role Client Isolation**: `createServiceRoleClient()` bypasses Row-Level Security (RLS). It is strictly restricted to authenticated server-side API handlers, admin mutations, and background sync jobs. It must **never** be imported or exposed to client-side bundles.
  - **Server Actions Authentication**: Server Actions must instantiate `createServerSupabaseClient()` on line one to authenticate claims and resolve user session identity.
  - **Row-Level Security (RLS)**: Every query must respect RLS policies consulting `auth.uid()` and cross-referencing `public.employees`.
- **Environment & Hosting**:
  - Cloud-First Hosted Mode: The project defaults to hosted Supabase SaaS (`mrwhtxbhrzyttlsyuofc`). Do not assume local Docker containers are active unless explicitly running local Supabase.

## Agent Tracing

- Record all client changes, auth flow modifications, and type sync events in `AGENT_TRACER.md` with an ISO 8601 timestamp.
- Place `// AGENT-TRACE: <explanation>` breadcrumbs on any custom header injection, token rotation, or telemetry middleware logic.
