# apps/portal/app/api/telemetry/drilling/

## Responsibility

Ingests drill rig IoT telemetry, persists it to `machine_telemetry`, caches latest machine state in Redis, appends live updates to a capped Redis stream, and exposes metrics as FUXA-pullable tags.

## Design

- Single `POST` route validated by `drillTelemetryIngestSchema`.
- Shared-secret auth via `authorizeIngest` (`@/lib/api/telemetry-auth`), using `TELEMETRY_INGEST_SECRET` or `TELEMETRY_WEBHOOK_SECRET`. Production fails closed (503) when unconfigured; non-production tolerates a missing secret for local development.
- Two rate limits: a per-IP entry cap (2400/min) through `withRateLimit`, and a per-machine cap (600/min) checked before the Supabase lookup.
- Machine authorization check against `machines` via Supabase server client.
- Database write is best-effort; Redis cache and SCADA sync are wrapped independently so one failure does not block the others.
- Reverse-flow SCADA sync writes per-metric tags under `telemetry:last:drill_<machine_id>_<metric>` with 24h TTL.

## Flow

1. `POST` enters `withRateLimit` (per-IP entry cap, path-scoped counter).
2. `authorizeIngest` rejects unsigned requests (401, or 503 in production when unconfigured).
3. `withBodyLimit` enforces the `1MB` payload limit.
4. Validate payload and default `timestamp` to now if missing.
5. Check the per-machine rate limit (`machine:<id>`, 600/min); return `429` when exceeded.
6. Look up machine by `machine_id`; return `404` if missing.
7. Insert telemetry row into `machine_telemetry`; log DB errors but continue.
8. Build `telemetryState` and:
   - `SET` `drilling:telemetry:last:<machine_id>` with 24h TTL
   - `XADD drilling:telemetry:stream MAXLEN ~ 1000` with the serialized state under the `data` field
   - Falls back to `PUBLISH` when the Redis adapter has no `xAdd` (serverless REST)
9. Write each numeric metric to `telemetry:last:drill_<machine_id>_<metric>` when defined and not NaN.
10. Return `{ success, machine_id, timestamp, scada_synced, data }`.

## Integration

- Uses `@repo/supabase/server` for DB access.
- Uses `@repo/redis` for state cache, the telemetry stream (pub/sub fallback), and SCADA tag namespace.
- Uses `@repo/contract/validation` and `drillTelemetryIngestSchema`.
- Uses `@/lib/api/telemetry-auth`, `@/lib/api/rate-limit-middleware`, `@/lib/api/cors`, and `@/lib/api/body-limit`.
- Appends to the same `drilling:telemetry:stream` key consumed by `drilling/stream`.
