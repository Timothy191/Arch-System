# apps/portal/app/api/telemetry/drilling/stream/

## Responsibility

Provides a real-time SSE endpoint that streams drill rig telemetry from the capped Redis stream `drilling:telemetry:stream`, replaying missed entries when a client reconnects.

## Design

- `GET` only; returns `text/event-stream` as a `NextResponse`.
- Connection budget: 60 connections/min per IP, path-scoped through `withRateLimit`.
- Shared-secret auth via `authorizeTelemetryStream` (`@/lib/api/telemetry-auth`): `TELEMETRY_STREAM_SECRET`, falling back to `TELEMETRY_INGEST_SECRET` / `TELEMETRY_WEBHOOK_SECRET`. Production fails closed (503) when unconfigured.
- Uses a duplicated Redis client via `@repo/redis` (`createRedisSubscriber`).
- Reads with `XREAD BLOCK 15000 COUNT 100`, starting at `$` for live-only or at the client's `Last-Event-ID` for replay.
- Emits each entry as `id: <stream-id>` plus `data: <telemetry-json>`, so browsers resume automatically after a disconnect.
- Sends an initial `connected` event (no id) and SSE comment heartbeats (`: ping`) every 15 seconds.
- Falls back to pub/sub subscribe on adapters without `XREAD` (serverless REST).
- Cleans up the heartbeat and disconnects the client on cancel/abort; `disconnect()` also breaks a pending blocking read.

## Flow

1. Client opens `GET /api/telemetry/drilling/stream` (optionally with `Last-Event-ID`).
2. `withRateLimit` applies the per-IP connection cap.
3. `authorizeTelemetryStream` rejects unsigned requests (401, or 503 in production when unconfigured).
4. Validate the id (`<ms>-<seq>`); otherwise start at `$`.
5. Create the Redis client, enqueue `connected`, start the 15s heartbeat.
6. Loop on `XREAD`; enqueue `id: <id>\ndata: <json>\n\n` for each entry.
7. On client abort or stream cancel: clear the heartbeat and disconnect the client.

## Integration

- Depends on `@repo/redis` client behavior.
- Uses `@/lib/api/telemetry-auth` and `@/lib/api/rate-limit-middleware`.
- Consumes entries appended by `apps/portal/app/api/telemetry/drilling`.
- The ingest route trims the stream to ~1000 entries, bounding replay memory.
- Live-Redis coverage lives in `apps/portal/test/integration/redis-primitives.integration.test.ts` (`REDIS_INTEGRATION=1`).
