# apps/portal/app/api/telemetry/drilling/

## Responsibility

Ingests drill rig IoT telemetry, persists it to `machine_telemetry`, caches latest machine state in Redis, publishes live updates to a Redis pub/sub stream, and exposes metrics as FUXA-pullable tags.

## Design

- Single `POST` route validated by `drillTelemetryIngestSchema`.
- Machine authorization check against `machines` via Supabase server client.
- Database write is best-effort; Redis cache and SCADA sync are wrapped independently so one failure does not block the others.
- Reverse-flow SCADA sync writes per-metric tags under `telemetry:last:drill_<machine_id>_<metric>` with 24h TTL.

## Flow

1. `POST` enters `withBodyLimit` (`1MB`).
2. Validate payload and default `timestamp` to now if missing.
3. Look up machine by `machine_id`; return `404` if missing.
4. Insert telemetry row into `machine_telemetry`; log DB errors but continue.
5. Build `telemetryState` and:
   - `SET` `drilling:telemetry:last:<machine_id>` with 24h TTL
   - `PUBLISH` `drilling:telemetry:stream`
6. Write each numeric metric to `telemetry:last:drill_<machine_id>_<metric>` when defined and not NaN.
7. Return `{ success, machine_id, timestamp, scada_synced, data }`.

## Integration

- Uses `@repo/supabase/server` for DB access.
- Uses `@repo/redis` for state cache, pub/sub, and SCADA tag namespace.
- Uses `@repo/contract/validation` and `drillTelemetryIngestSchema`.
- Uses `@/lib/api/cors` and `@/lib/api/body-limit`.
- Publishes to the same `drilling:telemetry:stream` channel consumed by `drilling/stream`.
