---
title: Project Overview & Tech Stack
created: 2026-06-15
updated: 2026-06-15
type: concept
tags: [architecture, overview, documentation, system, stack]
sources:
  [package.json, pnpm-workspace.yaml, nx.json, CLAUDE.md, PRODUCT.md, DESIGN.md]
confidence: high
---

# Project Overview & Tech Stack

Welcome to the **Arch-Systems (Plantcor) Mining Operations Portal** knowledge base. This document serves as the authoritative, comprehensive entry point for understanding the system's architecture, its technology stack, the reasoning behind key technical decisions, and the development workflow.

---

## 1. Executive Summary & Domain Context

Arch-Systems is an enterprise-scale, **on-premises first, multi-departmental mining operations portal** built for industrial vigilance and operational precision. The portal functions as a high-density control center, aggregating real-time telemetry, production yields, safety compliance, access control logs, and satellite mapping data.

### The 8 Operational Departments

The portal segregates operations into eight specialized departments, each featuring dedicated dashboards, daily logs, reports, and specialized tooling:

1. **Drilling Department**: Coordinates drill rig operations, borehole statuses, and real-time bit depth telemetry.
2. **Production Department**: Tracks coal yields, tonnage extracted, dump trucks, and overall extraction velocity.
3. **Access Control Department**: Manages site access logs, security badging, active personnel lists, and shift rosters.
4. **Engineering Department**: Houses equipment specifications, breakdowns tracking, preventative maintenance logs, and CAD reference attachments.
5. **Control Room Department**: Acts as the central SCADA interface, monitoring conveyor belts, operational delays, rollover incidents, and machinery status.
6. **Safety Department**: Governs compliance audits, safety incidents reporting, risk assessments, and environmental inspection checklists.
7. **Training Department**: Manages the Learning Management System (LMS), equipment certifications, training schedules, and employee competency checks.
8. **Satellite Monitoring Department**: Integrates synthetic aperture radar (SAR), InSAR ground deformation, hyperspectral analysis, and high-resolution optical imagery to monitor pit stability and environmental impacts.

---

## 2. Core Architectural Philosophies

Every technology choice in Arch-Systems was guided by three strict operational requirements:

### I. 100% Offline & Air-Gapped Readiness

Mining pits and remote operations are often deployed in environments with poor, intermittent, or completely non-existent internet access. The system must be capable of running entirely on local hardware (e.g., Rocky Linux servers) without external WAN dependencies.

- **Impact**: All services (including databases, caching, and AI helper systems) run inside local Docker networks. Cloud-dependent APIs are forbidden.

### II. High-Vigilance Ergonomics (Light Theme Only)

In high-stress, safety-critical industrial control rooms, ambient lighting is bright, and operators must monitor high-density data sheets for 12-hour shifts.

- **Impact**: The UI is hardcoded to a high-contrast **Light Theme** (`data-theme="light"`). Dark mode is explicitly omitted to prevent contrast degradation under industrial lighting and reduce cognitive fatigue. The visual system utilizes structured shadows, crisp borders, and a clean "liquid glass" layout for visual depth without layout thrashing.

### III. Database-Enforced Data Safety (RLS-First)

Operational and employee data is sacred. Security cannot rely solely on frontend gates or middleware.

- **Impact**: All access control and partition rules are defined at the database layer using PostgreSQL **Row Level Security (RLS)**. Even if middleware or API routing is bypassed, raw database queries are bound to the authenticated user's permissions and department scope.

---

## 3. Monorepo Architecture

The codebase is organized as an **Nx Monorepo** using **pnpm workspaces** for strict dependency management. Nx manages task pipeline caching (builds, linting, tests) while pnpm workspace catalogs prevent dependency version drift.

```
Arch-System/
├── apps/
│   ├── portal/             # Main Next.js 15 App Router application (port 3000)
│   ├── cms/                # Headless Payload CMS v3 for system docs (port 3001)
│   └── overview/           # Standalone Next.js 18 React Flow visualization (port 3002)
├── packages/
│   ├── theme/              # Design tokens (OKLCH, CSS variables, Tailwind preset)
│   ├── ui/                 # Shared UI library (Radix primitives + shadcn/ui components)
│   ├── supabase/           # Shared Supabase clients, Kysely wrappers, & auto-generated types
│   ├── database/           # Source of truth SQL migrations (61 sequential migrations)
│   ├── redis/              # Redis client configurations & caching utilities
│   ├── utils/              # Common helper functions (formatting, shifts, Inngest client)
│   ├── errors/             # Standardized domain error classes
│   ├── rate-limiter/       # Redis and in-memory rate limiting strategies
│   └── eval/               # Python & DeepEval LLM evaluation compliance harness
```

### Why Nx?

Previously managed under Turborepo, the monorepo was migrated to **Nx** to:

1. **Stabilize Jest Unit Testing**: Nx partitions Jest caches cleanly, preventing environment leakage across package boundaries.
2. **Fine-Grained Task Orchestration**: Nx targets depend directly on compile-order pipelines (e.g., `@repo/theme:build` runs token code generation via Style Dictionary, which `@repo/ui:build` consumes, which `apps/portal:build` depends on).
3. **Optimized Build Cache**: Nx computes SHA hashes of project source files, dependencies, and environment configurations to skip redundant compilations, saving significant development and CI compile time.

---

## 4. The Technology Stack & Design Decisions

### Frontend Stack

| Technology                   | Role          | Why It Was Chosen                                                                                                                                                                                                                           |
| :--------------------------- | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Next.js 15 (App Router)**  | Framework     | Next.js App Router enforces clean routing patterns (Route Groups). It separates client-side interactivity from server-side data fetching via React Server Components (RSC), drastically reducing JavaScript bundle sizes sent to clients.   |
| **React 19.2.6**             | UI Library    | Leverages the latest React compiler features, unified hooks (`useActionState`, `useFormStatus`), and native hydration error recovery, critical for complex state transitions.                                                               |
| **Tailwind CSS 3.4 (OKLCH)** | Styling       | Allows standard utility usage mapped directly to design tokens. The OKLCH color space ensures uniform perceptual contrast in color scales (essential for status indicators).                                                                |
| **Zustand 5**                | Client State  | Provides a lightweight, boilerplate-free state manager that runs outside the React render tree. Ideal for non-persisted global portal states, such as the active Shift Selector or layout Focus Mode.                                       |
| **Framer Motion & GSAP**     | Motion        | Framer Motion handles dynamic React state transitions and spring physics (such as active button presses). GSAP handles high-performance layout animations (like background wave patterns and heavy panel transitions) without causing jank. |
| **Lenis**                    | Smooth Scroll | Standardizes scrolling behaviors across varying client browsers, preventing jagged jumping in high-density table views.                                                                                                                     |

### Backend & Database Stack

| Technology                   | Role            | Why It Was Chosen                                                                                                                                                                                                                         |
| :--------------------------- | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL (Supabase)**    | Primary DB      | Industrial logging requires strict relational consistency (e.g., linking equipment, shifts, and safety incidents). Supabase provides a packaged Postgres environment with built-in pg_cron scheduling, pgvector extensions, and webhooks. |
| **Row Level Security (RLS)** | Authz           | Strict isolation. Security policies are bound directly to the `employees` table: role `employees.role` and department `employees.department_id` dictate database access limits, rather than client metadata.                              |
| **Kysely**                   | Query Builder   | Inside `@repo/supabase`, Kysely compiles type-safe SQL queries against the generated database schema types, preventing runtime SQL syntax errors while retaining full Postgres capabilities.                                              |
| **Redis**                    | Cache Layer     | Caches database queries, session tokens, and department slug-to-UUID lookups inside Next.js middleware, reducing database connection strain during traffic spikes.                                                                        |
| **Inngest**                  | Background Jobs | Implements durable, event-driven background workflows (e.g., periodic database syncs, reporting alerts, notifications) using simple serverless functions without the overhead of heavy message brokers like RabbitMQ or Kafka.            |

---

## 5. Local Offline AI Architecture

A core highlight of the portal is the **local, air-gapped AI agent infrastructure**, designed to run completely offline on-site.

```
┌────────────────────────────────────────────────────────┐
│                      LOCAL AI STACK                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [User Query] ──> [Portal API /api/ai]                  │
│                          │                             │
│                          ▼                             │
│               [LangGraph Orchestrator]                 │
│                 (gemma4:latest @ 11434)                │
│                 │                     │                │
│                 ▼                     ▼                │
│        [Tool Dispatcher]      [Vector Memory]          │
│       (Confidence Gated)     (pgvector + Nomic)        │
│                                                        │
│  Cache Systems:                                        │
│  - Embedding Cache (768-dim Nomics in DB)               │
│  - Tool Output Cache (In-memory LRU, 5s TTL)           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Key Decisions & Optimization

- **Local Ollama Inference**: All generative tasks utilize a local Ollama instance running the `gemma4:latest` model.
- **768-Dim Nomic Embeddings**: Swapped out cloud-based OpenAI embedding models for local `nomic-embed-text` (Migration 058). This reduced database vector dimensions from 1536 to 768, cutting database index overhead and speeding up cosine distance searches in `pgvector`.
- **LLM-Driven Tool Dispatching**: Rather than relying on fragile regex patterns, queries are evaluated by the local LLM to determine tool requirements. A confidence score (1-5 scale) is calculated. If the LLM has a confidence score of less than 3, the orchestrator halts execution to ask the user for clarification, preventing runaway token loops.
- **Persistent Embedding Cache**: A database table `embedding_cache` stores text hashes mapping to their 768-dim vectors. Duplicate text inputs bypass local LLM compute, retrieving pre-generated vectors instantly.
- **Tool Output Caching**: An in-memory LRU cache in `apps/portal/lib/ai/tool-cache.ts` deduplicates identical tool calls made during a user's session with a 5-second TTL.

---

## 6. Observability & Telemetry

High-availability mining operations require telemetry to detect silent failures and regressions.

- **Highlight.io**: Captures frontend session replays and correlates client actions with backend server traces, making debugging user issues straightforward in isolated setups.
- **OpenTelemetry (OTel)**: Auto-instruments Next.js server calls and database queries, piping metrics to a local Prometheus/Grafana monitoring dashboard.
- **Sentry**: Tracks server-side uncaught exceptions and middleware performance bottlenecks.

---

## 7. Development & Quality Check workflow

Developers are subject to a strict quality check gate to ensure the system remains production-ready and deployable at all times.

### The `pnpm quality` Command

Before pushing changes or staging deployments, developers must pass the full verification gate:

1. **syncpack** (`pnpm deps:lint`): Ensures dependency versions are aligned across all `package.json` configurations.
2. **knip** (`pnpm knip`): Detects dead code, unused exports, and orphaned dependencies.
3. **TypeScript compiler**: Compiles all projects (`tsc --noEmit`).
4. **Linting**: Lints source code (ESLint) and design tokens.
5. **Testing**: Runs Jest unit/integration tests and Playwright E2E suites.

### Git Infrastructure

- **Conventional Commits**: Enforced via `commitlint` on git commit hooks (Husky).
- **Secret Checking**: `secretlint` runs on every staged commit to prevent accidental leakages of credentials or local variables.
- **Mandatory Agent Tracing**: As detailed in [AGENT_TRACER.md](file:///home/timothy/Documents/Arch-System/AGENT_TRACER.md), all automated code modifications must document their changes, log runtime impact, and leave inline codebase comments (`// AGENT-TRACE:`) to ensure context continuity.

---

## 8. Deployment Stack

On-premises deployments target **Rocky Linux / RHEL** architectures.

- **Cockpit**: Installed on the local host to provide web-based system administration, service logs, and container monitoring.
- **Docker Compose**: Orchestrates target stacks (Portal, CMS, Redis caching, Supabase database, Ollama, Grafana).
- **systemd & firewalld**: Managed system services and local port restrictions configured via `./scripts/setup-production-environment.sh` to ensure high uptime and security.

---

## Related Documentation

- **[DOCUMENTATION_INDEX.md](file:///home/timothy/Documents/Arch-System/DOCUMENTATION_INDEX.md)** — Core navigation index.
- **[CLAUDE.md](file:///home/timothy/Documents/Arch-System/CLAUDE.md)** — Local commands and developer guidelines.
- **[DESIGN.md](file:///home/timothy/Documents/Arch-System/DESIGN.md)** — Tokens, HSL mapping, and typography.
- **[PRODUCT.md](file:///home/timothy/Documents/Arch-System/PRODUCT.md)** — User personas and product objectives.
- **[DEPLOYMENT.md](file:///home/timothy/Documents/Arch-System/DEPLOYMENT.md)** — Local and production deploy instructions.
- **[nx-monorepo](file:///home/timothy/Documents/Arch-System/docs/wiki/concepts/nx-monorepo.md)** — Workspace and build configs.
- **[supabase-local-dev](file:///home/timothy/Documents/Arch-System/docs/wiki/concepts/supabase-local-dev.md)** — Supabase local configuration.
- **[ai-service](file:///home/timothy/Documents/Arch-System/docs/wiki/concepts/ai-service.md)** — Ollama and local LLM configurations.
