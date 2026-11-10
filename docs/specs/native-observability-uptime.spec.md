# EARS Specification: Native Unified Observability & Uptime Layer (`SPEC-NATIVE-OBS-2026-11-10`)

- **Spec ID**: `SPEC-NATIVE-OBS-2026-11-10`
- **Status**: `DONE (2026-11-10)`
- **Date**: `2026-11-10`
- **Branch**: `feat/native-observability-uptime`

---

## 1. Objective

Reverse-engineer and unify the core mechanics of **Uptime Kuma** (90-tick stateful heartbeat strip, SLA availability rollups) and **Grafana** (4 Golden Signals time-series panels, stateful `NORMAL -> PENDING -> FIRING -> RESOLVED` alert rule evaluator with `forDurationMs` hysteresis) directly into **Arch-System** (`@repo/ui`, `apps/portal/lib/observability/`, `apps/portal/app/api/admin/observability/`, and `/admin/redis` + `/admin/workflows` + `ScadaPanel.tsx`) so the entire platform operates as **one unified application** across Vercel Serverless and on-premises servers.

---

## 2. EARS Requirements

### Zero-Overhead & Zero-API-Key Constraint

- **REQ-OBS-0 (Ubiquitous — Zero Cost & Zero New API Keys)**: THE implementation SHALL require **zero new API keys, zero new environment variables, zero external SaaS subscriptions, and zero new npm dependencies**, operating 100% over existing in-process ring buffers, `@repo/redis` (`CacheCategory.TELEMETRY`), and existing Supabase session authentication without background polling daemons that inflate serverless invocation costs.

### Phase 1: Native Uptime & Stateful Alert Engine (`apps/portal/lib/observability/`)

- **REQ-OBS-1 (Ubiquitous)**: THE `apps/portal/lib/observability/uptime-engine.ts` module SHALL record and retrieve up to 90 heartbeat ticks (`status: 'UP' | 'DEGRADED' | 'DOWN'`, `latencyMs`, `checkedAt`) per monitored target (`supabase`, `redis`, `fuxa_scada`, `portal_runtime`) and compute 24h, 7d, and 30d SLA availability percentages (`0` to `100`).
- **REQ-OBS-2 (Event-Driven)**: WHEN `evaluateAlertRule` in `apps/portal/lib/observability/alert-evaluator.ts` evaluates a metric sample against a rule threshold, THE state machine SHALL transition `NORMAL -> PENDING` upon first breach, transition `PENDING -> FIRING` only after `elapsedBreachMs >= forDurationMs`, and transition `FIRING -> RESOLVED -> NORMAL` when the metric recovers below the hysteresis threshold.
- **REQ-OBS-3 (Event-Driven)**: WHEN an authenticated caller queries `GET /api/admin/observability` (`apps/portal/app/api/admin/observability/route.ts`), THE route SHALL verify authentication (`getAuthenticatedEmployee`) and return live uptime heartbeats, SLA percentages, Golden Signals (`collectRealLayerRuntimeSnapshot`, `getCacheStats`, `collectRedisHealthDiagnostics`), workflow queue summaries, active alert evaluations, and a W3C `Server-Timing` header.

### Phase 2: Light-Mode OKLCH UI Primitives (`@repo/ui`)

- **REQ-OBS-4 (Ubiquitous)**: THE `@repo/ui` package SHALL export `UptimeHeartbeatStrip` (`packages/ui/src/components/UptimeHeartbeatStrip.tsx`, `@repo/ui/UptimeHeartbeatStrip`, and `@repo/ui`) rendering a 90-tick status bar (`UP` / `DEGRADED` / `DOWN`), service label, p95 latency, and SLA availability badge adhering to Light-Mode OKLCH tokens, `<= 20` Tailwind utilities per `className`, and `<= 2` positional parameters.
- **REQ-OBS-5 (Ubiquitous)**: THE `@repo/ui` package SHALL export `GoldenSignalPanel` (`packages/ui/src/components/GoldenSignalPanel.tsx`, `@repo/ui/GoldenSignalPanel`, and `@repo/ui`) rendering a Grafana-style metric panel inside `GlassCard` with current/p95 KPI badges, threshold status indicator (`NORMAL` | `PENDING` | `FIRING`), and sparkline bars.

### Phase 3: Unify Portal Admin & Control Room Views (`apps/portal`)

- **REQ-OBS-6 (Event-Driven)**: WHEN an operator opens `/admin/redis` (`apps/portal/app/admin/redis/page.tsx`) or `/admin/workflows` (`apps/portal/app/admin/workflows/page.tsx`), THE pages SHALL fetch live telemetry from `/api/admin/observability` (replacing the legacy external `arch-system-nest-proxy.vercel.app` fetch) and render `UptimeHeartbeatStrip` and `GoldenSignalPanel` with graceful fallback.
- **REQ-OBS-7 (Ubiquitous)**: THE Control Room `ScadaPanel` (`apps/portal/features/departments/components/control-room/ScadaPanel.tsx`) SHALL display a live SLA Uptime percentage badge (`data-testid="scada-sla-uptime-badge"`) derived from the rolling SCADA status probe history.
