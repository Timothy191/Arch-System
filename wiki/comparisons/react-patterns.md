---
title: React Rendering Pattern Comparison
created: 2026-05-15
updated: 2026-05-15
type: comparison
tags: [react, architecture, nextjs, decision]
sources: [wiki/concepts/portal-app-architecture.md, CLAUDE.md]
confidence: high
---

# React Rendering Pattern Comparison: App Router (RSC) vs Pages Router vs SPA

## What is Being Compared

Selection of React application architecture for a data-heavy operational portal with authentication, real-time updates, and department-specific routes.

## Dimensions of Comparison

| Dimension             | Next.js 15 App Router (RSC)                  | Next.js Pages Router              | Traditional SPA (Vite/CRA) |
| --------------------- | -------------------------------------------- | --------------------------------- | -------------------------- |
| **Default Rendering** | Server Components (RSC)                      | Client-side (CSR)                 | Client-side (CSR)          |
| **Data Fetching**     | Server (zero JS payload)                     | getServerSideProps/getStaticProps | useEffect + fetch          |
| **Bundle Size**       | Minimal (server-rendered)                    | Larger (hydration required)       | Largest (full app bundle)  |
| **SEO**               | Excellent                                    | Good                              | Requires prerendering      |
| **Real-time**         | Client components with subscriptions         | Full app subscriptions            | Native WebSocket           |
| **Authentication**    | Middleware + RSC validation                  | getServerSideProps validation     | Client-side guards         |
| **Performance**       | Streaming, partial hydration                 | Full page hydration               | Full app hydration         |
| **Learning Curve**    | Steeper (new patterns)                       | Moderate                          | Lower (familiar)           |
| **State Management**  | Server state via props, client state minimal | Global state needed               | Global state essential     |
| **Deployment**        | Vercel-optimized, Node runtime               | Vercel-optimized                  | Static/CDN or custom       |

## Project Implementation

The portal uses **Next.js 15 App Router with RSC as default**:

```typescript
// Server Component (default) — zero client JS
// app/(departments)/[department]/page.tsx
import { getDepartmentContext } from '~/lib/dept-context'

export default async function DepartmentPage({ params }: { params: { department: string } }) {
  const { dept, supabase } = await getDepartmentContext(params)
  const { data: machines } = await supabase.from('machines').select('*')

  return <DepartmentDashboard machines={machines} />
}
```

Client components used sparingly:

```typescript
// Client Component — interactivity required
// features/departments/components/control-room/AlertPanel.tsx
'use client'

export function AlertPanel() {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    const channel = supabase.channel('alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, callback)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return <AlertList alerts={alerts} />
}
```

## Why App Router Was Chosen

1. **RSC default** — Most portal pages are data displays that don't need client JavaScript
2. **Server data fetching** — Direct Supabase queries without API routes
3. **Streaming** — Progressive page loading for heavy dashboards
4. **Middleware** — Auth + department isolation at the edge
5. **Nested layouts** — Department layout persists across tab navigation
6. **React 19** — App Router is the future of React framework patterns

## Why Not Pages Router

Pages Router would require:

- `getServerSideProps` for every page (no component-level server logic)
- Full page hydration for interactivity
- Manual layout composition
- Less granular streaming control

App Router's nested layouts and RSC model are superior for this dashboard-heavy application.

## Why Not Traditional SPA

A Vite + React SPA would:

- Require custom routing (React Router)
- Need API layer for all data (no direct RSC → Supabase)
- Lose Next.js optimizations (image, font, script)
- Require separate auth middleware implementation

For a multi-tenant operational portal, framework-level features are essential.

## Verdict

**Next.js 15 App Router is optimal** for a data-heavy operational portal where most UI is read-only displays with isolated interactive components.

## Related

- [[portal-app-architecture]] — App Router structure and conventions
- [[supabase-local-dev]] — Server Component data fetching patterns
- [[state-management]] — How client state is minimized
