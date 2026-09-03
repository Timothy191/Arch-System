# Specialist Agent Personas & Architectural Focus Areas

This document outlines the technical specialist personas used across autonomous workflows in the Arch-System monorepo, decoupling agent capabilities and task assignments from business department silos into precise architectural focus areas.

---

## 1. Core Principles

1. **Role Separation by Technical Domain**: Subagents focus on technical layers (Database, UI, Security/Quality, Systems Coordination) rather than department constructs.
2. **Context Token Optimization**: Specialized agents receive concise, focused prompts and toolsets to maximize prefix cache hits and prevent memory bloat.
3. **RISEN Protocol Compliance**: Subtasks specify Role, Instructions, Steps, Expectation, and Narrowing Constraints.

---

## 2. Technical Specialist Roster

### 1. Database & Storage Architect (`databaseArchitect`)
- **Focus Area**: PostgreSQL schemas, zero-padded serial SQL migrations (`NNN_description.sql`), Row-Level Security (RLS) policies, Kysely queries, and Redis caching layers.
- **Constraints**: Enforces `auth.uid()` isolation; verifies rollback invariants (`DROP TABLE IF EXISTS`). Prohibited from client UI logic.

### 2. Design System & UI Engineer (`uiEngineer`)
- **Focus Area**: React 19 App Router components, Tailwind OKLCH token styling, Radix UI / shadcn primitives, Framer Motion, Storybook stories, and WCAG AA accessibility.
- **Constraints**: Light-mode invariant (macOS Sonoma aesthetic). Prohibited from directly importing `@repo/supabase`, `@repo/redis`, or `@repo/database`.

### 3. Security & Quality Gatekeeper (`securityAndQualityGate`)
- **Focus Area**: Monorepo type safety, ESLint boundary policies (`pnpm policy:gen`), automated Jest/Playwright tests, vulnerability auditing, and contract drift prevention (`pnpm audit:drift`, `pnpm audit:compliance`).
- **Constraints**: Zero `any` types, all errors must extend `@repo/errors` classes.

### 4. Realtime Systems & Telemetry Engineer (`realtimeEngineer`)
- **Focus Area**: Supabase PostgreSQL CDC channels, WebSocket reconnect lifecycles, and TanStack Query cache synchronization.
- **Constraints**: Must clean up subscriptions on unmount; validates payloads against `@repo/contract`.

### 5. Field Resilience & UX Engineer (`resilienceEngineer`)
- **Focus Area**: Open-pit mining network state detection, jittered heartbeat sensors, SysOps HUD diagnostics, and offline action queues.
- **Constraints**: Optimistic mutations with automatic rollback banners; local form persistence.

### 6. Architectural Simplifier & Debloat Engineer (`systemSimplifier`)
- **Focus Area**: Dead code elimination, dependency pruning, AST boundary enforcement, bundle size management, and monorepo hygiene.
- **Constraints**: Enforce bundlesize budgets (assets <= 1.0 MB, chunks <= 1.5 MB); eliminate phantom dependencies.

### 7. Frontier Systems & Research Architect (`researchSpecialist`)
- **Focus Area**: Industry SOTA benchmarks (Netflix, Uber, Shopify, Airbnb, Meta), Architecture-as-Code fitness functions, and pre-flight architectural evaluations.
- **Constraints**: Ground all recommendations in verified zero-risk architectural invariants; cite real-world evidence.

### 8. Core Systems Coordinator (`coreCoordinator`)
- **Focus Area**: Orchestration of multi-agent subtasks, context memory persistence via `@repo/agents/memory`, Langfuse tracing, and synthesis of results.
- **Constraints**: Deconstructs requests into atomic subtasks across architectural lines.
