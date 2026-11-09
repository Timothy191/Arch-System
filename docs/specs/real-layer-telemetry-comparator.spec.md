# EARS Specification: Real-Layer Differential Telemetry & Baseline Comparator

## 1. Objective

Implement a 4-layer **Real-Layer Differential Telemetry & Baseline Comparator** (`pnpm perf:real-layer`, `pnpm perf:baseline`, `pnpm perf:compare`) that measures true Node.js 24 V8/Event-Loop metrics, live TCP Redis L1/L2/Stream/Lock p50/p95/p99 latencies, W3C `Server-Timing` HTTP response headers, and commit-to-commit $\Delta\%$ performance diffs without relying on mocks.

## 2. Scope

1. [`apps/portal/lib/observability/metrics.ts`](file:///home/tim/Fork/Arch-System/apps/portal/lib/observability/metrics.ts): Add Node.js 24 `perf_hooks.monitorEventLoopDelay()`, `performance.eventLoopUtilization()`, and `v8.getHeapStatistics()` gauges (`node_event_loop_utilization_ratio`, `node_event_loop_delay_ms`, `node_v8_heap_used_bytes`) and export `collectRealLayerRuntimeSnapshot()`.
2. [`apps/portal/app/api/metrics/route.ts`](file:///home/tim/Fork/Arch-System/apps/portal/app/api/metrics/route.ts) & [`apps/portal/app/api/metrics/route.test.ts`](file:///home/tim/Fork/Arch-System/apps/portal/app/api/metrics/route.test.ts): Unify the Control Room & Node 24 Prometheus registry (`getMetrics()`) into `/api/metrics` and emit W3C `Server-Timing` headers.
3. [`apps/portal/app/api/health/route.ts`](file:///home/tim/Fork/Arch-System/apps/portal/app/api/health/route.ts), [`apps/portal/app/api/health/route.test.ts`](file:///home/tim/Fork/Arch-System/apps/portal/app/api/health/route.test.ts), [`apps/portal/app/api/control-room/scada-status/route.ts`](file:///home/tim/Fork/Arch-System/apps/portal/app/api/control-room/scada-status/route.ts), and [`apps/portal/app/api/control-room/shift-completeness/route.ts`](file:///home/tim/Fork/Arch-System/apps/portal/app/api/control-room/shift-completeness/route.ts): Emit W3C `Server-Timing` headers exposing real per-service durations (`supabase;dur=...`, `redis;dur=...`, `fuxa;dur=...`, `total;dur=...`).
4. [`tools/scripts/real-layer-benchmark.mjs`](file:///home/tim/Fork/Arch-System/tools/scripts/real-layer-benchmark.mjs), [`package.json`](file:///home/tim/Fork/Arch-System/package.json), and [`tools/audits/audit-observability-resilience.cjs`](file:///home/tim/Fork/Arch-System/tools/audits/audit-observability-resilience.cjs): Execute live 100-iteration probes across Node 24 Event-Loop/V8, Redis TCP (`PING`, L1/L2 cache, `XADD`/`XRANGE`, distributed lock `SET NX PX`/`DEL`), CSS/bundle byte sizes, and 27-gate execution evidence, persisting `.ci-local/real-layer-baseline.json` and computing before/after $\Delta\%$ verdicts.

## 3. EARS Acceptance Criteria

- **WHEN** `GET /api/metrics` is requested, **THE SYSTEM SHALL** return unified Prometheus metrics including cache counters, Inngest job counters, database query counters, Control Room shift-closeout/SCADA histograms (`control_room_*`), and Node 24 runtime gauges (`node_event_loop_utilization_ratio`, `node_event_loop_delay_ms`, `node_v8_heap_used_bytes`), along with a W3C `Server-Timing` header.
- **WHEN** `GET /api/health`, `GET /api/control-room/scada-status`, or `GET /api/control-room/shift-completeness` responds, **THE SYSTEM SHALL** attach a W3C `Server-Timing` header containing measured sub-layer durations in milliseconds.
- **WHEN** `pnpm perf:real-layer` is executed, **THE SYSTEM SHALL** run 100 live iterations against the Node 24 runtime and `:6379` TCP Redis server, compute p50/p95/p99 latencies (in ms/µs), compare against `.ci-local/real-layer-baseline.json`, and emit a structured `BEFORE vs. AFTER (Δ%)` table and JSON report (`.ci-local/real-layer-report.json`).

## 4. Constraints & Rollback

- Zero `any` types, max 2 positional parameters per function, and 0 circular dependencies / 0 dead code (`pnpm cycles && pnpm knip`).
- Rollback: `git revert` the feature commit on `main`.
