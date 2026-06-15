---
source_url: https://raw.githubusercontent.com/DRACOSFN/Turborepo-Fullstack-Starter-Template/master/packages/ui/Template-Fullstack-Starter-Turborepo-v1.1.zip
ingested: 2026-05-15
sha256: 30a9bfc44e098082c0e7cdb66a0b5bc99bc489df0e88a9ee4f687d9141c0548c
---

# Arch-Systems (Plantcor)

Arch-Systems (Plantcor) is a multi-departmental mining operations portal built as a monorepo using Turborepo 2.1, Next.js 15, React 19, and Supabase. It provides authenticated access to department-specific dashboards for drilling, production, access control, engineering, control room, safety, training, and satellite monitoring.

## Monorepo Structure

- apps/portal/ → Next.js 15 app (App Router, React 19, port 3000)
- apps/overview/ → Standalone Next.js app for architecture visualization (React 18, port 3002)
- apps/cms/ → Payload CMS v3 (headless, Postgres-backed)
- packages/theme/ → @repo/theme — design tokens, CSS variables, Tailwind preset
- packages/ui/ → @repo/ui — shared components (GlassCard, DepartmentLayout, KPI, PageHeader, ShiftToggle, FormFields, shadcn primitives)
- packages/supabase/ → @repo/supabase — client wrappers (browser, server, middleware) and database types
- packages/database/ → @repo/database — SQL migrations (16 migrations, source of truth)
- packages/hooks/ → @repo/hooks — useLocalStorage, useDebounce
- packages/utils/ → @repo/utils — cn(), formatDate(), getCurrentShift(), excel utilities
- packages/eslint-config/ → @repo/eslint-config
- packages/typescript-config/ → @repo/typescript-config

## Portal App Router Structure

- (auth)/login/ → Login page with Supabase Auth
- (hub)/ → Landing page after login; shows department grid + productivity tools
- (departments)/[department]/ → Dynamic department routes with tabs
- admin/ → Admin panel
- api/ai/chat → AI service endpoint (multi-provider with failover)
- api/tools/status → External tool health checks

## Key Conventions

- Path aliases: @/ and ~/ both map to apps/portal/
- Dark theme via Tailwind CSS variables from @repo/theme (className="dark" on <html>)
- All Tailwind config originates from @repo/theme — never add theme values directly in portal
- RLS policies scoped by employees.auth_id = auth.uid()
- Three Supabase client contexts: browser, server, middleware. Always import from @repo/supabase, never directly from @supabase/supabase-js
- Middleware enforces auth + department isolation with 60s UUID lookup cache
- Auth trigger handle_new_user() auto-creates employee row on signup with role defaulting to 'operator'
- pnpm workspace catalogs centralize shared dependency versions

## Key Tables

departments, employees, machines, daily_logs, machine_hours, fuel_logs, production_logs, operators, sites, hourly_loads, breakdowns, machine_operations, operational_delays, engineering_notes, excavator_activity, dozer_rolls, safety_incidents, audit_logs.

## Department-specific Features

Department-specific component logic lives in apps/portal/features/departments/components/<dept>/ (control-room, engineering, machines, satellite). Hub components in features/hub/components/. Shared layout and primitives from @repo/ui.

## Technology Versions

- Next.js 15.0.0
- React 19.0.0
- TypeScript 5.6.3
- Tailwind CSS 3.4.13
- pnpm 9.12.0
- Node.js >=20.17.0

## Key Gotchas

- @react-three/fiber v8.x + @react-three/drei v9.x (React 19 compatible)
- React version divergence: apps/overview uses React 18, apps/portal uses React 19 — no cross-app component sharing
- Never commit middleware auth bypass changes without security review
- Migration source of truth: packages/database/migrations/; packages/supabase/supabase/migrations/ is a deploy-time copy
- @univerjs/preset-sheets-core/lib/index.css must be imported once in UniverSheet.tsx only — never in layout.tsx
- Forbidden Tailwind classes: font-bold, font-semibold, bg-white/5, border-white/10, text-white/50, text-white/70, shadow-\*
