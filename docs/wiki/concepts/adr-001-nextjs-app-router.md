---
title: "ADR-001: Next.js 16 App Router Adoption"
created: 2026-05-15
updated: 2026-05-25
type: decision
status: accepted
tags: [adr, architecture, nextjs, decision]
sources: [docs/wiki/comparisons/react-patterns.md, CLAUDE.md]
confidence: high
---

# ADR-001: Next.js 16 App Router Adoption

## Status

**Accepted** — Implemented May 2024; migrated to Next.js 16.2.6 on May 25, 2026

## Context

We needed to choose a React framework and routing architecture for the mining operations portal. The application requirements included:

- Server-side data fetching for operational data
- Real-time dashboard updates
- Multi-department routing with shared layouts
- Authentication-protected routes
- Minimal JavaScript payload for dashboard displays

## Decision

We adopt **Next.js 16 with the App Router**, using **React Server Components (RSC) as the default rendering strategy**.

### Key Choices Within This Decision

1. **App Router over Pages Router** — Nested layouts, streaming, RSC support
2. **Server Components by default** — Only client components when interactivity needed
3. **Next.js 16.2.6** — Latest stable with React 19.2.6 compatibility, Turbopack by default, async Request APIs

## Consequences

### Positive

- **Reduced bundle sizes** — Server-rendered pages ship minimal JavaScript
- **Simplified data fetching** — Direct Supabase queries in RSC, no API layer needed
- **Nested layouts** — Department layout persists across tab navigation
- **Streaming** — Progressive loading for heavy dashboard data
- **Middleware** — Edge-based auth + department isolation
- **Future-proof** — Aligns with React/Next.js long-term direction

### Negative

- **Learning curve** — Team must learn RSC patterns, cache behavior
- **Ecosystem maturity** — Some third-party libs still adapting to RSC
- **Debugging complexity** — Server/client boundary can be confusing
- **Migration effort** — Would require refactor if coming from Pages Router

### Neutral

- **Vercel coupling** — Optimal on Vercel, but works elsewhere with `next start`

## Alternatives Considered

### Next.js Pages Router (REJECTED)

- Full page hydration required
- No nested layouts
- Less granular streaming control
- Legacy pattern (maintenance mode)

### Traditional SPA (Vite + React Router) (REJECTED)

- No server-side rendering
- Requires API layer for all data
- Loses Next.js optimizations (images, fonts, scripts)
- Would need custom auth middleware

## Implementation Notes

- RSC → Supabase queries via `createServerSupabaseClient()`
- Client components marked with `'use client'`
- Real-time updates isolated to client components (`AlertPanel`, `ScadaPanel`)
- Path aliases: `@/` and `~/` → `apps/portal/`

## Related

- [[portal-app-architecture]] — Full architecture details
- [[comparisons/react-patterns]] — Comparison with alternatives
- [[nx-monorepo]] — How this fits in monorepo
