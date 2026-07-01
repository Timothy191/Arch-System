# Wiki Index

> Content catalog for the Arch-Systems (Plantcor) company knowledge base.
> Read this first to find relevant pages for any query.
> Last updated: 2026-06-18 | Total pages: 60 (16 concepts + 9 entities + 9 comparisons + 8 ADRs + 6 queries + 5 operational + 4 gittree + 2 reports + 1 schema)
> Current project version: Phase 5.2 (Localisation & Nx) | Next.js 15 | React 19.2.6 | Supabase | Light Theme | 61 Migrations

## Quick Reference

| I need to...                  | Go to                                                 |
| ----------------------------- | ----------------------------------------------------- |
| Understand project history    | [[gittree/README\|Git Tree & Branches]]               |
| View project structure        | [[arch-systems]]                                      |
| Understand system & stack     | [[project-overview]]                                  |
| Start developing              | [[nx-monorepo]] → [[supabase-local-dev]]              |
| Build a department feature    | [[department-features]] → [[portal-app-architecture]] |
| Add UI components             | [[design-system]]                                     |
| Work with database            | [[database-schema]] → [[rls-policy]]                  |
| Implement auth                | [[auth-middleware]]                                   |
| Set up external tools         | [[external-tools]]                                    |
| Monitor/debug                 | [[monitoring-error-tracking]]                         |
| Debug issues                  | [[how-to-debug-issues]]                               |
| Deploy code                   | [[how-to-deploy-production]]                          |
| Set up production server      | [[on-premises-deployment]]                            |
| Understand observability      | [[monitoring-error-tracking]]                         |
| Improve test coverage         | [[testing-qa-strategy]]                               |
| Scale the database            | [[database-optimization]]                             |
| Add mobile/PWA support        | [[mobile-pwa]]                                        |
| Build analytics & reports     | [[analytics-reporting]]                               |
| Understand data visualization | [[gittree/visual-graphs-reporting]]                   |
| Learn code graph analysis     | [[gittree/conceptual-code-graphs]]                    |
| Study graph algorithms        | [[gittree/graph-data-structures]]                     |
| See why we chose X            | [[Comparisons]] section below                         |

---

## Entities (9)

- [[arch-systems|Arch-Systems (Plantcor)]] — Multi-departmental mining operations portal built as an Nx monorepo
- [[drilling-department|Drilling Department]] — Drill rig operations & bit depth telemetry
- [[production-department|Production Department]] — Coal yield, tonnage & extraction tracking
- [[access-control-department|Access Control Department]] — Site access, badging & security
- [[engineering-department|Engineering Department]] — Equipment specs, maintenance & CAD
- [[control-room-department|Control Room Department]] — SCADA systems & real-time monitoring
- [[safety-department|Safety Department]] — Safety incidents, compliance, and inspection workflows
- [[training-department|Training Department]] — LMS, certifications & competency tracking
- [[satellite-monitoring-department|Satellite Monitoring Department]] — SAR/InSAR, hyperspectral & high-resolution imagery

## Concepts (17 + 9 ADRs + 5 Operational + 4 Git Tree)

### Architecture & Setup

- [[project-overview|Project Overview & Tech Stack]] — Authoritative entry point for system architecture, the technology stack, design decisions, and development workflow
- [[nx-monorepo|Nx Monorepo Structure]] — Workspace layout, target configuration defaults, and build commands (migrated from Turborepo)
- [[supabase-local-dev|Supabase Local Development]] — Local DB, auth, and storage setup with remote sync
- [[portal-app-architecture|Portal App Architecture]] — Next.js 15 App Router, RSC, server actions, and feature organization

#### Architecture Decision Records (ADRs)

- [[adr-001-nextjs-app-router|ADR-001]] — Next.js 15 App Router adoption
- [[adr-002-supabase-backend|ADR-002]] — Supabase as backend platform
- [[adr-003-turborepo-monorepo|ADR-003 (Superseded)]] — Turborepo for monorepo management
- [[adr-004-tailwind-design-system|ADR-004]] — Tailwind CSS with design tokens
- [[adr-005-zustand-state-management|ADR-005]] — Zustand for client state
- [[adr-007-react-19-adoption|ADR-007]] — React 19 adoption strategy
- [[adr-008-nx-monorepo|ADR-008]] — Nx for Monorepo Management (supersedes ADR-003)

#### Operational Guides

- [[troubleshooting|Troubleshooting Guide]] — Common issues and fixes
- [[deployment|Deployment Runbook]] — Production deployment procedures
- [[on-premises-deployment|On-Premises Deployment & Cockpit]] — Linux server provisioning, Cockpit setup, offline deployment
- [[onboarding|Team Onboarding]] — New developer setup guide
- [[incident-response|Incident Response Playbook]] — Production incident handling

### Database & Security

- [[database-schema|Database Schema]] — Full PostgreSQL schema (61 migrations) with RLS policies, tables, and views
- [[rls-policy|RLS Policy Standards]] — Row Level Security requirements and auth helpers
- [[auth-middleware|Auth and Middleware]] — Supabase auth flow, middleware, role-based access, cross-department permissions
- [[database-optimization|Database Optimization & Scaling]] — Partitioning, PgBouncer, read replicas, materialized views

### Features

- [[department-features|Department Features]] — Control room, engineering, safety, satellite monitoring capabilities
- [[external-tools|External Tools Integration]] — n8n, Flowise, Univer embedding, Inngest background jobs, Novu notifications, health checks
- [[monitoring-error-tracking|Monitoring and Error Tracking]] — Sentry, Highlight session replay, OpenTelemetry tracing, Prometheus/Grafana, real-time subscriptions, satellite monitoring API
- [[analytics-reporting|Advanced Analytics & Reporting]] — Executive KPI dashboard, PDF/Excel export, trend analysis, ML predictive maintenance

### Quality & Design

- [[design-system|Portal Design System]] — Light-only macOS Sonoma Tailwind design tokens, Style Dictionary pipeline, and shared components
- [[testing-qa-strategy|Testing & QA Strategy]] — Unit coverage 40%+, E2E critical flows, visual regression, load & security testing
- [[mobile-pwa|Mobile Responsiveness & PWA]] — Offline support, touch-optimized forms, PWA install

### Git Tree & Project History

- [[gittree/README|Git Tree History]] — Complete git graph from project start to Phase 5.2, all branches and milestones
- [[gittree/visual-graphs-reporting|Visual Graphs for Reporting]] — Data visualization for metrics, dashboards, and analytics
- [[gittree/conceptual-code-graphs|Conceptual Code Graphs]] — ASTs, CFGs, CPGs for static analysis and security scanning
- [[gittree/graph-data-structures|Graph Data Structures]] — Algorithms (BFS, DFS, Dijkstra), adjacency representations

## Comparisons (9)

- [[testing-frameworks|Testing Framework Comparison]] — Jest vs Vitest vs Node.js Test Runner for React 19
- [[state-management|State Management Comparison]] — Zustand vs Redux Toolkit vs React Context for RSC architecture
- [[rich-text-editors|Rich Text Editor Comparison]] — Novel vs Tiptap vs Slate.js vs Lexical
- [[monorepo-tools|Monorepo Tool Comparison]] — Nx vs Turborepo vs pnpm workspaces
- [[database-backend|Database/Backend Comparison]] — Supabase vs Firebase vs self-hosted PostgreSQL
- [[map-libraries|Map/GIS Library Comparison]] — react-map-gl + MapLibre vs Google Maps vs Leaflet
- [[styling-approaches|Styling Approach Comparison]] — Tailwind CSS vs CSS-in-JS vs CSS Modules
- [[react-patterns|React Rendering Pattern Comparison]] — App Router (RSC) vs Pages Router vs SPA
- [[animation-libraries|Animation Library Comparison]] — Framer Motion vs React Spring vs GSAP vs CSS-only

## Reports (2)

Comprehensive project analysis and visual dashboards:

- [[project-comprehensive-report|Project Comprehensive Report]] — Full system analysis with architecture diagrams, performance metrics, and 5 recommended next steps
- [[project-report-visual|Visual HTML Report]] — Interactive dashboard with charts, graphs, and real-time metrics visualization

## Queries (6)

Curated answers to common questions:

- [[how-to-add-department|Q: How do I add a new department?]] — Step-by-step department creation
- [[how-does-auth-work|Q: How does authentication work?]] — Auth flow, RLS, and security
- [[how-to-fetch-data|Q: How should I fetch data?]] — Server Components, Actions, real-time
- [[why-query-returns-empty|Q: Why is my query returning empty?]] — Database/RLS debugging
- [[how-to-deploy-production|Q: How do I deploy to production?]] — Deployment checklist
- [[how-to-debug-issues|Q: How do I debug issues?]] — General debugging guide
