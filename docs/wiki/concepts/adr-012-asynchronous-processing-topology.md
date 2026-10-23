---
title: 'ADR-012: Asynchronous Processing & Event-Driven Topology'
created: 2026-10-23
updated: 2026-10-23
type: decision
status: accepted
tags: [adr, backend, architecture, events, redis-streams, inngest, outbox]
sources:
  [
    apps/portal/app/api/inngest/route.ts,
    packages/redis/src/streams.ts,
    packages/database/migrations/162_idempotency_and_outbox.sql,
  ]
confidence: high
---

# ADR-012: Asynchronous Processing & Event-Driven Topology

## Status

**Accepted** — Architecture Standardized October 2026

## Context

The Arch-System backend coordinates diverse asynchronous requirements:

- Sub-second IoT/SCADA sensor telemetry streaming (drilling feeds, machine health).
- Guaranteed-delivery transactional events (shift closeouts, operator sign-offs, machine breakdown alerts).
- Heavyweight, multi-step batch jobs (PDF shift compilation reports, monthly Excel rollups, vector embedding indexing).
- Scheduled background maintenance (contractor expiry sweeps, preventative maintenance checks).

Previously, four mechanisms were used concurrently without clear demarcation:

1. Inngest Serverless Event System (`apps/portal/app/api/inngest/route.ts`).
2. Redis Streams & Consumer Groups (`@repo/redis/streams.ts`).
3. PostgreSQL Transactional Outbox (`control_room_outbox`).
4. HTTP Scheduled Crons (`apps/portal/app/api/cron/*`).

This lack of explicit boundaries risked:

- Executing blocking consumer loops (`XREADGROUP ... BLOCK`) within serverless Next.js routes, triggering HTTP 504 lambda timeouts.
- Inundating relational PostgreSQL tables with high-frequency sensor readings.
- Relying on non-transactional pub/sub triggers for safety-critical domain events.

## Decision

We establish a **Tiered Asynchronous Processing Matrix**, defining unambiguous ownership for each event and asynchronous processing category:

| Tier       | Category                                   | Technology                                                | Guarantee                                                                     | Primary Use Cases                                                                                         |
| :--------- | :----------------------------------------- | :-------------------------------------------------------- | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **Tier 1** | **Real-Time Telemetry & Sensor Streaming** | **Redis Streams** (`@repo/redis/streams`)                 | Low-latency, ephemeral, at-most-once or at-least-once within retention buffer | SCADA tag updates, machine GPS/drilling telemetry, SSE live feeds, real-time dashboards                   |
| **Tier 2** | **Transactional Domain Events**            | **PostgreSQL Outbox** (`control_room_outbox`)             | Guaranteed at-least-once, ACID-atomic with database mutations                 | Shift lockouts, operator dispatches, safety incident alerts, audit event captures                         |
| **Tier 3** | **Durable Multi-Step Workflows**           | **Inngest Orchestration** (`apps/portal/app/api/inngest`) | Retriable, step-checkpointed, observable with backoff                         | Daily PDF report generation, monthly Excel rollups, vector embedding generation, shift rollover workflows |
| **Tier 4** | **Scheduled Maintenance**                  | **Vercel Crons & Inngest Crons** (`/api/cron/*`)          | Scheduled invocation with bearer token auth                                   | Nightly data aggregation, stale lock cleanup, contractor badge expirations                                |

### Runtime & Execution Boundary Rules

1. **Serverless Isolation**:
   - Next.js 16 Serverless route handlers (`app/api/*`) and Server Actions MUST remain purely request/response.
   - Long-lived blocking consumer loops (`consumeStream` with continuous `XREADGROUP`) MUST NOT be initiated inside Next.js serverless execution contexts.
   - Continuous stream consumption is reserved for long-lived processes (e.g. background container services in `infra/docker/compose.tools.yml` or dedicated Node.js daemon workers).

2. **Transactional Outbox Drainage**:
   - Outbox rows are committed within the primary domain transaction.
   - Outbox drainage runs via [`outboxDrainFn`](apps/portal/lib/jobs/outbox-drain.ts) on Inngest with idempotency keys (`arch:idemp:*`).

3. **Telemetry Ingestion**:
   - Sensor inputs enter through Redis Streams (`XADD`) with approximate buffer capping (`MAXLEN ~ 1000`).
   - Telemetry archiving batches readings asynchronously into PostgreSQL cold storage via scheduled Inngest sync tasks.

4. **Distributed Tracing & Context Propagation**:
   - Every event payload across Inngest and Redis Streams MUST propagate the originating `traceparent` and `x-request-id` to preserve end-to-end distributed observability.

## Consequences

### Positive

- **Predictable Latency**: High-frequency sensor streams bypass Postgres write locks entirely.
- **Transactional Integrity**: Financial and operational compliance events are never dropped due to transient network hiccups.
- **Serverless Stability**: Eliminates connection leakages and function timeout risks in Next.js Edge/Serverless environments.

### Negative / Trade-offs

- **Multiple Infrastructure Dependencies**: Requires maintaining Redis 7.4 alongside PostgreSQL and Inngest.
- **Eventual Consistency**: Downstream consumers of outbox events operate with an eventual consistency window (typically <500ms).
