# apps/portal/app/api/telemetry/push/

## Responsibility

Accepts telemetry tag updates and Supabase `machine_telemetry` webhook payloads, deduplicates them, and writes the latest values into Redis so the SCADA/FUXA side can pull current tags via `/api/scada/tags`.

## Design

- Single `POST` route with two payload modes:
  - Webhook mode: `{ table: "machine_telemetry", record: { ... } }`
  - Direct tag mode: `{ name, value }`
- Two-level dedup cache:
  - L1: in-memory `localLastValues`
  - L2: Redis `telemetry:last:<name>` with 24h TTL
- Validation is applied only to direct tag updates; webhook mode is parsed manually because its shape differs from `telemetryPushSchema`.
- CORS and body-limit middleware wrap the handler.

## Flow

1. `POST` enters `withBodyLimit`.
2. `handlePost` parses JSON once.
3. If `body.table === "machine_telemetry"` and `body.record` exists:
   - iterate non-null metrics
   - build tag names like `machine_<machine_id>_<metric>`
   - run L1/L2 checks
   - on change, update L1 and Redis
   - return per-tag results
4. Otherwise delegate to `handleDirectTag`:
   - validate `{ name, value }`
   - run L1/L2 checks
   - on change, update L1 and Redis
5. Response includes `success`, `synced`, and `cached` flags; webhook mode also includes `processed` and `results`.

## Integration

- Reads/writes Redis via `@repo/redis`.
- Uses `@repo/contract/validation` and `telemetryPushSchema` for direct updates.
- Uses `@/lib/api/cors` and `@/lib/api/body-limit`.
- Feeds the SCADA reverse-flow ingest path; FUXA does not write back through this endpoint.
