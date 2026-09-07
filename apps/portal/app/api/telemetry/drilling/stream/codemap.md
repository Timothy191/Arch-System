# apps/portal/app/api/telemetry/drilling/stream/

## Responsibility

Provides a real-time SSE endpoint that streams live drill rig telemetry to clients by forwarding Redis pub/sub messages from `drilling:telemetry:stream`.

## Design

- `GET` only; returns `text/event-stream`.
- Uses a `ReadableStream` with a Redis subscriber created via `@repo/redis`.
- Sends an initial `connected` event, then forwards every pub/sub message as `data: ...`.
- Sends SSE comment heartbeats (`: ping`) every 15 seconds to keep proxies and clients alive.
- Cleans up subscriber, unsubscribe, and heartbeat timer on stream cancel or request abort.

## Flow

1. Client opens `GET /api/telemetry/drilling/stream`.
2. Create Redis subscriber and subscribe to `drilling:telemetry:stream`.
3. Enqueue a welcome event with `event: "connected"`.
4. Start a 15s keep-alive interval.
5. On each Redis message, enqueue `data: <json>\n\n`.
6. On client abort or stream cancel:
   - clear heartbeat interval
   - unsubscribe and quit subscriber if open

## Integration

- Depends on `@repo/redis` subscriber/client behavior.
- Consumes events published by `apps/portal/app/api/telemetry/drilling`.
- Intended for dashboard or operator clients needing live drill telemetry without polling.
