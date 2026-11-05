# Performance & Observability Architecture Integration

**Status:** Proposed specification  
**Applies to:** `apps/portal` (Next.js 16 App Router + React 19)  
**Derived from:** Architectural adaptations document (performance intelligence, intelligent module loading, centralized resource management, observability & instrumentation)

---

## 1. Objective

Incorporate the recommended architectural adaptations into Arch-System as **permanent, first-class architectural components** — built into the architecture, not added as an afterthought. The system must measure its own performance rather than relying on assumptions.

The integration establishes five layers:

| Layer                         | Responsibility                                             | New component                                              |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Application & User Experience | Fast rendering, responsive interactions, resource delivery | Existing (WebVitalsReporter, Speed Insights, lazy loading) |
| Intelligent Execution         | Lazy loading, module lifecycle, dependency management      | `ModuleRegistry`                                           |
| Resource Management           | Caching, static assets, resource optimization              | `ResourceRegistry`                                         |
| Observability & Intelligence  | Metrics, logging, tracing, analytics                       | `PerformanceMonitor`, `PerformanceRegressionDetector`      |
| Governance & Configuration    | Policies, metadata, instrumentation, integration standards | `MetadataRegistry`, `IntegrationRegistry`                  |

---

## 2. Arch-System classification

The reference document asks whether Arch-System is primarily:

- **A** A Next.js / React application
- **B** A modular software architecture with multiple independent subsystems
- **C** An AI-powered platform with agents, services and orchestration
- **D** A broader system architecture combining several technologies

**Answer: D.** Arch-System is a Next.js 16 App Router + React 19 portal (`apps/portal`) built with Turborepo, backed by Supabase (Postgres + Realtime CDC), Redis (multi-tier L1/L2 cache), and an agent orchestration layer (`@repo/agents`). It is a Next.js core with multiple subsystems — not a single-framework app (A), not purely independent subsystems (B), and not primarily an AI platform (C).

### Mapping recommendations to Arch-System

| Recommendation                                         | Disposition                  | Rationale                                                                                                                                 |
| ------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Performance intelligence layer                         | **Permanent core component** | `PerformanceMonitor` + `PerformanceRegressionDetector` in `apps/portal/lib/performance`                                                   |
| Intelligent module loading                             | **Permanent core component** | `ModuleRegistry` (Core / Active / On-Demand + shared services)                                                                            |
| Centralized resource management                        | **Permanent core component** | `ResourceRegistry` (images, fonts, static files, config assets, downloadable resources, cached responses, external resources)             |
| OpenTelemetry tracing                                  | **Adopt directly**           | Already integrated via `instrumentation.ts` + `@vercel/otel`; enhanced to record startup time + errors                                    |
| Logs                                                   | **Enhance existing**         | `@repo/logger` (Pino) already wired; errors now also flow into `PerformanceMonitor`                                                       |
| Metrics                                                | **Enhance existing**         | Prom-client endpoints (`/api/metrics`, `/api/metrics/prometheus`) already exist; `PerformanceMonitor` adds in-memory measurement baseline |
| Central Metadata Registry                              | **Permanent core component** | `MetadataRegistry` in `apps/portal/lib/observability/metadata.ts`                                                                         |
| Controlled Integration Management                      | **Permanent core component** | `IntegrationRegistry` in `apps/portal/lib/observability/integration.ts`                                                                   |
| Lazy loading                                           | **Enhance existing**         | `LAZY_LOADING_GUIDE.md` + `next/dynamic` wrappers already exist; `ModuleRegistry` adds programmatic lifecycle                             |
| Proprietary telemetry protocol                         | **Reject**                   | OpenTelemetry is the standard; do not invent a proprietary protocol                                                                       |
| Copy next/image / next/link / bundle analyzer verbatim | **Reject**                   | Adopt the principles (image optimization, intelligent navigation, dependency analysis) for the actual stack, not the Next.js APIs         |

---

## 3. Scope

### In scope

- `docs/architecture/PERFORMANCE_OBSERVABILITY_INTEGRATION.md` — this specification
- `apps/portal/lib/performance/monitor.ts` — `PerformanceMonitor`: startup time, module execution time, API response time, resource consumption, memory utilization, error frequency, cache effectiveness
- `apps/portal/lib/performance/regression.ts` — `PerformanceRegressionDetector`: baseline comparison, regression severity classification
- `apps/portal/lib/performance/performance-baselines.json` — committed baselines for regression detection
- `apps/portal/lib/modules/registry.ts` — `ModuleRegistry`: Core / Active / On-Demand module lifecycle + shared services
- `apps/portal/lib/resources/registry.ts` — `ResourceRegistry`: centralized resource catalog
- `apps/portal/lib/observability/metadata.ts` — `MetadataRegistry`: central metadata registry
- `apps/portal/lib/observability/integration.ts` — `IntegrationRegistry`: controlled third-party integration management
- `apps/portal/instrumentation.ts` — wire startup-time measurement, baselines, core-module registration, error recording
- Co-located `*.test.ts` tests for each new module

### Out of scope

- OpenTelemetry collector / Prometheus server deployment (infrastructure concerns)
- Replacing existing prom-client metrics endpoints or `WebVitalsReporter` (enhance, don't duplicate)
- E2E / Playwright changes
- Bundle analyzer integration
- Client-side `window`/`document` access in the monitor (kept environment-agnostic)

---

## 4. Acceptance criteria

- `pnpm --filter portal type-check` passes
- `pnpm --filter portal lint` (Biome) passes on changed files
- `pnpm --filter portal test` passes, including the new module tests
- No regressions in existing portal tests
- `pnpm policy:check` boundary rules respected — new code imports only `@repo/*` packages and internal `apps/portal` modules

---

## 5. Constraints

- **Layering rules:** `apps/portal` may import `@repo/*`; `@repo/*` packages must never import `apps/*`. New libs import only `@repo/*` packages and sibling `apps/portal/lib` modules.
- **Strict TypeScript:** no `any`, no `@ts-ignore`.
- **Biome conventions:** 2-space indent, 100 columns, single quotes, semicolons, ES5 trailing commas.
- **Code quality rules:** guard clauses with early returns; max two positional parameters (three+ inputs use a typed options object); no banned identifiers (`data`, `value`, `val`, `item`, `info`, `temp`, `tmp`, `flag`, `obj`, `arr`); immutable parameters; named constants instead of magic numbers; lookup maps over `if/else` ladders.
- **OpenTelemetry is the tracing standard** — do not invent a proprietary telemetry protocol.
- **Bounded memory:** all measurements use fixed-size rolling buffers; no unbounded growth.
- **No serverless file writes:** regression baselines are read-only config loaded at register time.

---

## 6. Risks

| Risk                       | Mitigation                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Circular dependencies      | New libs import only `@repo/*` and sibling portal modules; no imports back into `instrumentation.ts` from the libs |
| Runtime overhead           | Fixed-size rolling buffers; O(1) record operations; baselines loaded once at startup                               |
| Serverless incompatibility | File I/O (baselines) gated on `NEXT_RUNTIME === 'nodejs'`; monitor itself is pure TypeScript                       |
| Dead code (knip)           | All new singletons are imported by `instrumentation.ts` and/or co-located tests                                    |

---

## 7. Implementation roadmap (aligned to the document)

| Phase | Implementation                                                                         | Priority |
| ----- | -------------------------------------------------------------------------------------- | -------- |
| 1     | Performance measurement baseline — `PerformanceMonitor` + startup measurement          | Critical |
| 2     | Dependency and resource analysis — `ResourceRegistry` + metadata                       | High     |
| 3     | Lazy loading and module lifecycle — `ModuleRegistry`                                   | High     |
| 4     | Centralized caching and asset management — resource catalog + existing Redis cache     | High     |
| 5     | Logging, metrics and tracing — wire monitor + errors into `instrumentation.ts`         | High     |
| 6     | Metadata and integration governance — `MetadataRegistry` + `IntegrationRegistry`       | Medium   |
| 7     | Automated performance regression testing — `PerformanceRegressionDetector` + baselines | High     |

---

## 8. Verification

Run from the repo root:

```bash
pnpm --filter portal type-check
pnpm --filter portal lint
pnpm --filter portal test -- --testPathPatterns="performance|modules|resources|observability/(metadata|integration)"
pnpm policy:check
```
