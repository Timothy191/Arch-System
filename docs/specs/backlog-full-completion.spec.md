# EARS Specification: Full Arch-System Backlog Completion (Tracks 1–4)

- **Spec ID**: `SPEC-BACKLOG-FULL-2026-11-10`
- **Status**: `DONE (2026-11-10)`
- **Date**: `2026-11-10`
- **Branch**: `feat/backlog-full-completion`

---

## 1. Objective

Autonomously implement and verify all remaining backlog items across **Arch-System** (`@repo/redis`, `apps/portal`, `libs/*`, `packages/ui`, `packages/theme`, `infra/`, and `docs/`) using coordinated specialist agent teams starting with **Track 1 (Redis & Caching Layer)**, followed by **Track 2 (Control Room Phase 3 Engineering & Docs)**, **Track 3 (Frontend Performance, IndexedDB Drafts & CSS Tokenization Batches 2–6)**, and **Track 4 (Infrastructure & Audit Ledger Reconciliation)**.

---

## 2. Requirements (EARS Syntax)

### Track 1: Redis & Caching Layer Completion (`@repo/redis`, `apps/portal`)

- **REQ-T1-1 (Ubiquitous)**: THE `@repo/redis` registry (`packages/redis/src/registry.ts`) SHALL include `TELEMETRY: 'telemetry'`, `REPORTS: 'reports'`, and `SESSIONS: 'sessions'` in `CacheCategory` and `CACHE_TTL_REGISTRY`, with `REPORTS` and `SESSIONS` classified as `'write-through-durable'` and `TELEMETRY` classified as `'ephemeral-cache'`.
- **REQ-T1-2 (Event-Driven)**: WHEN `cacheInvalidateTagsBatch(tags, options)` is invoked in `@repo/redis`, THE system SHALL resolve tag member keys across all supplied tags using pipelined/batched scans, execute non-blocking `UNLINK` batches, purge local L1 memory before broadcasting, and emit at most one cross-instance Pub/Sub invalidation message.
- **REQ-T1-3 (Ubiquitous)**: THE `@repo/redis` telemetry & metrics modules (`packages/redis/src/metrics.ts`, `packages/redis/src/stats.ts`) SHALL track and expose L1 eviction count/rate (`l1_eviction`), L2 round-trips (`l2_round_trip`), privilege version changes (`privilege_version_change`), and write-through delay (`write_through_delay_ms`).
- **REQ-T1-4 (Event-Driven)**: WHEN `schedulePredictiveCacheWarm(candidates)` is invoked in `packages/redis/src/adaptive.ts`, THE system SHALL prioritize hot keys whose TinyLFU access frequency (`getKeyFrequency`) exceeds the warming threshold and refresh their cache entries ahead of expiration.
- **REQ-T1-5 (Event-Driven)**: WHEN numeric SCADA telemetry points are published or analyzed via `detectScadaStreamAnomaly` in `packages/redis/src/streams.ts`, THE system SHALL compute rolling mean/variance (Online online algorithm) and flag points whose z-score exceeds the configured anomaly threshold.
- **REQ-T1-6 (Event-Driven)**: WHEN a Redis cluster node replies with a `MOVED <slot> <host:port>` or `ASK <slot> <host:port>` error, THE `parseClusterRedirect` and `executeWithClusterRedirect` utilities in `packages/redis/src/cluster.ts` SHALL parse the slot and target endpoint, issue `ASKING` when required, and retry the operation against the target node within `maxRedirects`, eliminating the legacy `TODO` in `cluster.ts`.
- **REQ-T1-7 (Ubiquitous)**: THE test file `apps/portal/lib/tools.test.ts` SHALL remove the deprecated `cachedRSC` mock, and `docs/plans/2026-11-02-caching-consolidation/follow-up-f-k-spec.md` SHALL be marked `DONE (2026-11-10)`.

### Track 2: Control Room Phase 3 Engineering & Operational Guides

- **REQ-T2-1 (Event-Driven)**: WHEN `validateMachineOperationConstraints` in `apps/portal/lib/shift-completeness.ts` validates machine operation payloads, THE system SHALL enforce shift hour limits (`0 <= hours <= 12`), `bin_factor` bounds (`0.1 <= binFactor <= 50`), and cross-field SMR consistency (`closingSmr >= openingSmr`, `smrDelta <= shiftDurationHours`).
- **REQ-T2-2 (Ubiquitous)**: THE repository SHALL provide all 9 Control Room Phase 3 operational guides under `docs/control-room/` (`pin-reset-procedure.md`, `machine-registration-guide.md`, `supervisor-workflow.md`, `scada-user-guide.md`, `alert-response-procedures.md`, `architecture.md`, `data-flows.md`, `caching-strategy.md`, `troubleshooting.md`) and mark all completed tasks in `docs/operations/CONTROL_ROOM_IMPLEMENTATION_TODO.md` and `docs/operations/FUXA_PRODUCTION_CONFIG.md`.

### Track 3: Frontend Optimization, IndexedDB Drafts & CSS Tokenization Batches 2–6

- **REQ-T3-1 (Event-Driven)**: WHEN an operator edits `DailyLogForm`, THE form draft persistence layer (`apps/portal/lib/storage/indexeddb-draft-storage.ts`) SHALL persist draft state asynchronously to IndexedDB (`arch_drafts_db`) with deterministic fallback to `localStorage` for SSR/restricted environments.
- **REQ-T3-2 (Ubiquitous)**: THE frontend optimization items in `docs/plans/2026-10-29-optimization-todo-list.md` (`next/image` `sizes`, resource hints, `React.memo`/`useMemo`, IndexedDB draft persistence, Redis/DB/Network/Monitoring items) and CSS Tokenization Batches 2–6 (`docs/specs/CSS_TOKENIZATION_ORDER.md`) SHALL be implemented, verified, and marked `[x]`.

### Track 4: Infrastructure Documentation & Audit Ledger Reconciliation

- **REQ-T4-1 (Ubiquitous)**: THE `infra/README.md` documentation SHALL document the container orchestration, Prometheus/Grafana/Alertmanager monitoring stack, MinIO remote cache, and on-premises deployment runbooks, and `docs/reports/PROJECT_AUDIT_UPGRADE_PLAN.md`, `docs/wiki/PROJECT_STATUS_SUMMARY.md`, and `docs/wiki/STATUS.md` SHALL be updated to reflect 100% completion.
