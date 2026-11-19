# Arch-System SCADA Edge Telemetry Worker

## Architectural Role

`workers/scada-monitor.js` is a standalone Cloudflare Workers ES Module (`arch-system-scada-monitor`) that augments the primary Next.js 16 portal hosted on Vercel (`https://arch-system.vercel.app`). It handles edge sensor heartbeat ingestion, staleness evaluation, and read-only WebSocket connection acknowledgements without proxying or replacing primary portal traffic.

### Strict Read-Only Industrial Safety Boundary

Edge telemetry workers must never issue operational commands to mine-site PLCs, actuators, or SCADA control buses. Every ingest request and Durable Object heartbeat call iterates the full JSON payload (up to depth `32`), rejects prototype-pollution or shadow keys (`__proto__`, `constructor`, `prototype`, `toString`, `valueOf`, `hasOwnProperty`), and blocks normalized case/delimiter variants of control-write keys (`command`, `commands`, `writeTag`, `controlWrite`, `plcCommand`, `setpointWrite`, `actuatorCommand`, `modbusWrite`, `opcWrite`, `opcuaWrite`, `coilWrite`, `registerWrite`, `forceCoil`, `writeCoil`, `writeRegister`, `emergencyOverride`) with `403 Forbidden`.

## Route Contract

| Method | Path                   | Purpose                                  | Auth & Notes                                                                                     |
| :----- | :--------------------- | :--------------------------------------- | :----------------------------------------------------------------------------------------------- |
| `GET`  | `/`                    | Service manifest & route index           | Public read-only metadata                                                                        |
| `GET`  | `/health`              | Fast edge liveness probe                 | Does not invoke Durable Object                                                                   |
| `GET`  | `/status`              | Coordinator health & stale sensor count  | Returns `healthy` or `degraded`                                                                  |
| `POST` | `/telemetry/heartbeat` | Ingest validated sensor heartbeat        | Fail-closed HMAC-SHA256 + idempotency                                                            |
| `POST` | `/upload`              | Compatibility ingest alias               | Same validation & safety rules                                                                   |
| `GET`  | `/telemetry/summary`   | Tracked sensors with `ageMs` & `isStale` | Reads sharded Durable Object storage                                                             |
| `GET`  | `/geo`                 | Safe JSON geolocation metadata           | Uses `JSON.stringify` (no raw interpolation)                                                     |
| `GET`  | `/ws`                  | Read-only WebSocket control channel      | Emits `scada.ack`, answers `ping` -> `scada.pong`, closes `1008` on writes, `426`/`501` fallback |

## `AgentCoordinator` Durable Object & Bindings

`wrangler.toml` binds the `AgentCoordinator` SQLite-backed Durable Object class under `AGENT_COORDINATOR`:

- State is sharded cleanly to remain well under Cloudflare's Durable Object key/value limits:
  - `scada:edge:meta`: `{ startedAtIso, totalHeartbeatsIngested, lastHeartbeatAt, nextOrderSeq }`
  - `scada:edge:index`: `{ sensorIndex, recentIdempotencyKeys }` (pruned after `300_000` ms)
  - `sensor:<sensorId>`: per-sensor latest payload, bounded at `500` active sensors with deterministic FIFO eviction and `64` metrics / `512`-char string limits
- Evaluates sensor staleness against `SCADA_STALE_THRESHOLD_MS` (default `60000` ms).
- When `AGENT_COORDINATOR` is bound, responses report `mode: "durable-object"`. When running outside a Durable Object namespace (such as standalone tests), the worker falls back to an in-memory adapter and reports `mode: "standalone"`.

## Security Controls

1. **Fail-Closed HMAC-SHA256 Authentication & Anti-Replay**: `wrangler.toml` defaults to `REQUIRE_SCADA_AUTH="true"`. Without a non-empty `SCADA_INGEST_SECRET`, ingest fails closed with `503 Service Unavailable`. When active, requests must provide `X-Arch-Signature-256: sha256=<hex>` computed over `${X-Arch-Timestamp}.${idempotencyKey}.${rawBody}` within `±300_000` ms. Signed requests without `X-Idempotency-Key` are replay-checked by canonical digest and rejected with `401 Unauthorized` on duplicate replay.
2. **Idempotency Deduplication**: Supplying a safe `X-Idempotency-Key` prevents duplicate heartbeat counting within the replay window (`200 OK` with `deduplicated: true`).
3. **Streaming UTF-8 Byte Limits**: Enforces valid numeric `Content-Length` (`400` on malformed) and a `1 MiB` (`1048576` bytes) ceiling streamed directly from `request.body` without buffering oversized payloads into RAM.
4. **Hardened Response Headers**: Every response sets `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: no-referrer`, `cache-control: no-store`, and `x-request-id`.
5. **Secret Provisioning**: Configure production secrets via Wrangler out-of-band:

```bash
wrangler secret put SCADA_INGEST_SECRET
```

## Verification

Run the unit suite, Wrangler dry-run bundle check, Biome check, markdownlint, and spellcheck from the repository root:

```bash
pnpm test:workers
wrangler deploy --dry-run --outdir /tmp/arch-wrangler-check && rm -rf /tmp/arch-wrangler-check
pnpm biome check workers/
pnpm exec markdownlint --config config/tools/.markdownlint.json workers/README.md
pnpm exec cspell workers/scada-monitor.js workers/scada-monitor.test.mjs workers/README.md --config config/tools/cspell.json --no-progress
```
