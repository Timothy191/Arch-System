---
title: Arch-Systems (Plantcor)
created: 2026-05-14
updated: 2026-06-03
type: entity
tags: [system, application, company]
sources: [nx.json, packages/database/migrations/, package.json]
confidence: high
---

# Arch-Systems (Plantcor)

Arch-Systems (Plantcor) is a multi-departmental mining operations portal built as a monorepo. It provides authenticated access to department-specific dashboards for drilling, production, access control, engineering, control room, safety, training, and satellite monitoring.

## Technology Stack

- **Frontend:** Next.js 15 (App Router, React 19.2.6), Tailwind CSS 3.4, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Read Replicas)
- **Build/Orchestration:** Nx 22.7.5 + pnpm 9.15.9 workspaces
- **Testing:** Jest 30 (unit), Playwright 1.60 (E2E)
- **3D:** @react-three/fiber 8 + @react-three/drei 9
- **Maps:** react-map-gl 8 + maplibre-gl 5
- **AI:** Local Ollama (`gemma4:latest` for chat, `nomic-embed-text` for 768-dim embeddings)
- **State:** Zustand 5
- **Observability:** Highlight.io (session replay, server tracing) + OpenTelemetry

## Monorepo Structure

- `apps/portal/` → Next.js 15 app with App Router, React 19 (main mining portal)
- `packages/ui/` → [[nx-monorepo|@repo/ui]] — shared components, Radix/shadcn primitives
- `packages/theme/` → [[design-system|@repo/theme]] — design tokens, Style Dictionary pipeline, Tailwind preset
- `packages/supabase/` → [[supabase-local-dev|@repo/supabase]] — client wrappers (browser, server, middleware, read-replica) and database types
- `packages/database/` → [[database-schema|@repo/database]] — SQL migrations (61 migrations, source of truth)
- `packages/hooks/` → @repo/hooks — useLocalStorage, useDebounce
- `packages/utils/` → @repo/utils — cn(), formatDate(), getCurrentShift(), excel utilities
- `packages/errors/` → @repo/errors — standardized custom error handler classes
- `packages/rate-limiter/` → @repo/rate-limiter — memory & Redis rate limiting strategies
- `apps/overview/` → Standalone Next.js app for architecture visualization (port 3002)
- `apps/cms/` → Payload CMS v3 (headless, Postgres-backed)

## Key Shared Components

- `GlassCard` — Card container with light theme glassmorphism styling
- `DepartmentLayout` — Sidebar + content layout for department pages
- `KPI`/`KPIGrid` — Summary metric cards
- `PageHeader` — Title + formatted date header
- `ShiftToggle` — Day/night shift selector
- `FormFields` — Consistent light theme form controls

## Portal App Router

- `(auth)/login/` → Supabase Auth login
- `(hub)/` → Department grid + productivity tools
- `(departments)/[department]/` → Dynamic department routes with layouts
- `admin/` → Admin panel with role-based access
- `api/ai/` → LLM agent graph execution endpoint

## Department Routes

Standard departments get: dashboard, daily-log, machines, history, reports, tools.
Specialized routes:

- `control-room`: dashboard, hourly-loads, machine-operations, operational-delays, engineering-notes, excavator-activity, roll-over, machines, reports, satellite
- `engineering`: dashboard, breakdowns, daily-log, machines, history, reports, tools
- `satellite-monitoring`: overview, sar, hyperspectral, highres

## Auth & Security

- Three client contexts: browser, server, middleware
- RLS policies scoped by `employees.auth_id = auth.uid()`
- `handle_new_user()` trigger auto-creates employee row on signup (hardened to ignore user-supplied metadata roles)
- Column-level constraints on `public.employees` prevent self-elevation by non-admins
- `employees.accessible_departments` allows cross-department access

## Key Gotchas

- @react-three/fiber v8.x + @react-three/drei v9.x (React 19 compatible)
- Never commit middleware auth bypass without security review
- Migration source of truth: `packages/database/migrations/`
- `@univerjs/preset-sheets-core/lib/index.css` import once only in `UniverSheet.tsx` — never in layout.tsx
- React version divergence: `apps/overview` uses React 18, `apps/portal` uses React 19 — no cross-app component sharing
- All Tailwind config originates from `@repo/theme` — never add theme values directly in portal

## Current Status (Nx & Ollama Era)

- **Previous milestones:** Foundation → Phase 2 (Safety & Agentic Loop) → Phase 3 (Advanced Agent Infrastructure) → Phase 5.1 (Performance) — all complete.
- **Nx & Ollama Migration complete:** Migrated workspace task runner to Nx to stabilize Jest unit tests and partition caches. Swapped cloud-based AI endpoints (Groq, OpenRouter) with local Ollama (`gemma4`) to support 100% offline air-gapped deployments, migrating embeddings to 768-dim Nomics vectors with a persistent, user-isolated embedding cache.

### Current Metrics

| Metric                | Value                 |
| --------------------- | --------------------- |
| Departments           | 8/8 operational       |
| Database tables       | 40+ with full RLS     |
| Database migrations   | 61 migrations         |
| Test coverage         | ~40%+ (target: 90%)   |
| Mobile responsiveness | 68% avg (target: 85%) |
| Security posture      | 100% (P0 fixes done)  |
| Wiki pages            | 61                    |
