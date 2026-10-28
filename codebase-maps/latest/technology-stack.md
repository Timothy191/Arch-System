# ⚡ Technology Stack & Catalog Map

**Generated:** ${dateInfo.displayDate}  
**Architecture:** Federated Turborepo Monorepo + Next.js 16 App Router + Supabase PostgreSQL 17

---

## 🛠️ Technology Catalog & Runtime Specifications

| Layer                         | Technology               | Version / Spec             | Responsibility                                                           |
| :---------------------------- | :----------------------- | :------------------------- | :----------------------------------------------------------------------- |
| **Monorepo Engine**           | Turborepo + pnpm         | Turbo 2.x, pnpm 9.15.9     | Task pipeline hashing, catalog versioning, remote caching                |
| **Frontend Framework**        | Next.js App Router       | 16.3.8                     | Edge request proxy (`proxy.ts`), React Server Components, Server Actions |
| **UI Runtime**                | React                    | 19.x                       | Concurrent transitions, `use()` promise unwrap, Server Components        |
| **Design System**             | OKLCH Tokens + Tailwind  | Tailwind 3.4.x             | Light-mode only, semantic OKLCH color space, Liquid GlassCard surfaces   |
| **Persistence**               | Supabase PostgreSQL      | PostgreSQL 17              | PgBouncer pool, 189 immutable SQL migrations, 100% InitPlan RLS          |
| **Cache & Limits**            | Redis Cluster            | Redis 7.x                  | L1/L2 cache tags, RBAC sessions, stream consumer groups, token bucket    |
| **Contracts & Validation**    | Zod                      | Zod 3.x (`@repo/contract`) | Canonical mutation and query schemas with zero database-to-API drift     |
| **Telemetry & Observability** | OpenTelemetry + Langfuse | OTEL SDK + Langfuse        | Distributed spans, AI agent cost accounting, trace inspection            |
| **Testing & Quality**         | Biome, Jest, Playwright  | Modern Agent Toolchain     | Strict linting, unit/integration testing, visual regression testing      |

---

## 🏛️ Architectural Decision Records (ADRs)

- **ADR-001: Next.js 16 Request Proxy over middleware.ts**  
  _Context:_ Next.js 16 replaces `middleware.ts` with `proxy.ts`.  
  _Decision:_ Route all edge requests through `apps/portal/proxy.ts` to generate per-request `x-nonce` and set strict Content-Security-Policy headers before delegating auth claims to `server/proxy.ts`.

- **ADR-002: Capability-Only Redis Façade**  
  _Context:_ Direct Redis command execution introduces vendor lock-in and fails in serverless environments.  
  _Decision:_ All Redis interactions ride the transport façade `raw.ts` in `@repo/redis`. Exposes dedicated doors: caching, sessions, streams, locks, analytics, and vector search with automatic graceful degradation.

- **ADR-003: Pure Light-Mode OKLCH Design Tokens**  
  _Context:_ Industrial mining pit displays require extreme outdoor daylight contrast.  
  _Decision:_ Enforce a single canonical light mode (canvas `#f3f4f6`) using perceptual OKLCH color primitives from `@repo/theme`. Dark mode variants (`dark:`) and raw hex codes are strictly prohibited.

- **ADR-004: Zod Contract Parity as Single Source of Truth**  
  _Context:_ Discrepancies between SQL schemas and frontend types cause runtime mutation crashes.  
  _Decision:_ All API payloads and database tables require Zod schemas in `packages/contract/src/schemas/`. CI enforces 100% parity via `pnpm audit:drift`.
