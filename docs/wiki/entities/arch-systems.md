---
title: Arch-Systems (Plantcor)
created: 2026-05-14
updated: 2026-11-17
type: entity
tags: [system, application, company]
sources: [turbo.json, packages/database/migrations/, package.json, AGENTS.md]
confidence: high
---

# Arch-Systems (Plantcor / Arch OS)

Arch-Systems (Plantcor / Arch OS) is a production multi-departmental mining operations portal built as a Turborepo 2.x monorepo. It provides authenticated, role-scoped access to department workspaces for control room, drilling, production, plant processing, plant inventory, engineering, availability and utilization, access control, office, executive hub, system overview, and database administration.

## Technology Stack

- **Frontend:** Next.js 16.4.6 (App Router, React 19.2.7), Tailwind CSS 3.4 (Light-mode OKLCH + Metallic Gold `#d4af37`), Radix UI
- **Backend:** Cloud Supabase (PostgreSQL 17, Auth, Storage, Realtime CDC, Read Replicas) + Redis 7.4 (L1/L2 cache, sessions, RediSearch, streams)
- **Build/Orchestration:** Turborepo 2.10.12 + pnpm 9.15.9 workspaces on Node.js >=24.0.0
- **Testing & Verification:** Jest 30 (unit), Playwright 1.65 (E2E), 28-gate `pnpm agent:verify` + Autonomous CI Gatekeeper (`pnpm ci:gatekeeper`)
- **3D & Visualization:** @react-three/fiber + @react-three/drei, React Flow, Recharts
- **Maps:** react-map-gl 8 + maplibre-gl 5
- **State:** TanStack Query + Zustand 5 + XState 5 + IndexedDB offline queue
- **Observability:** Native Observability Console (`/admin/observability`), OpenTelemetry Collector, Prometheus, Grafana (light mode), Woodpecker CI, VibeMon `v32`, and Sentry v10

## Monorepo Structure

- `apps/portal/` → Next.js 16 app with App Router, React 19 (main mining portal)
- `packages/ui/` → [[turborepo-monorepo|@repo/ui]] — shared components, Radix/shadcn primitives
- `packages/theme/` → [[design-system|@repo/theme]] — design tokens, Style Dictionary pipeline, Tailwind preset
- `packages/supabase/` → [[supabase-local-dev|@repo/supabase]] — client wrappers (browser, server, middleware, read-replica) and database types
- `packages/database/` → [[database-schema|@repo/database]] — SQL migrations (111 migrations, source of truth)
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

## Department Routes

Standard departments get: dashboard, daily-log, machines, history, reports, tools.
Specialized routes:

- `control-room`: dashboard, hourly-loads, machine-operations, operational-delays, engineering-notes, excavator-activity, roll-over, machines, reports
- `engineering`: dashboard, breakdowns, daily-log, machines, history, reports, tools
- `access-card-actions`: card issuance, batch printing, access logs

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

## Current Status (Turborepo Era)

- **Previous milestones:** Foundation → Phase 2 (Safety & Agentic Loop) → Phase 3 (Advanced Agent Infrastructure) → Phase 5.1 (Performance) — all complete.
- **Turborepo Migration complete:** Migrated workspace task runner to Turborepo to stabilize Jest unit tests and partition caches. Removed generative AI features and Ollama service from deployment stack.

### Current Metrics

| Metric                | Value                 |
| --------------------- | --------------------- |
| Departments           | 8/8 operational       |
| Database tables       | 40+ with full RLS     |
| Database migrations   | 111 migrations        |
| Test coverage         | ~40%+ (target: 90%)   |
| Mobile responsiveness | 68% avg (target: 85%) |
| Security posture      | 100% (P0 fixes done)  |
| Wiki pages            | 87                    |
