# Architectural Decision Record: Asynchronous Processing & Event-Driven Topology

- **Reference**: [`docs/wiki/concepts/adr-012-asynchronous-processing-topology.md`](../wiki/concepts/adr-012-asynchronous-processing-topology.md)
- **Status**: Accepted (October 2026)
- **Scope**: Backend event streaming, background job execution, and transactional outbox.

---

## The 4-Tier Processing Model

```
                    [ Inbound Event / Mutation ]
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
 [ Telemetry / SCADA ]    [ Domain State Change ]    [ Long Batch / Report ]
         │                        │                        │
         ▼                        ▼                        ▼
  Tier 1: Redis Stream     Tier 2: Postgres Outbox      Tier 3: Inngest Workflow
  • Low latency            • ACID consistency           • Multi-step retriable
  • Capped MAXLEN ~        • Guaranteed at-least-once   • Checkpointed steps
  • In-memory fan-out      • Drain to event queues      • PDF/Excel rendering
```

### Invariants for Agents & Engineers

1. **Never run blocking stream loops in Next.js routes**: `consumeStream` or `XREADGROUP ... BLOCK` must run in dedicated background processes or Docker containers (`infra/docker/`), never inside Next.js serverless functions.
2. **Transactional events must use Outbox**: Shift closeout locks, operator approvals, and machine breakdown dispatches must write an outbox record inside the DB transaction, not fire-and-forget HTTP/pubsub.
3. **Sensor feeds must not write directly to Postgres**: Ingest telemetry into Redis Streams first; batch write to cold storage asynchronously.
4. **Propagate Tracing**: Always attach `x-request-id` and W3C `traceparent` to Redis stream fields and Inngest event payloads.
