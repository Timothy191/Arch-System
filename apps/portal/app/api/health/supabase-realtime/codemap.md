# Supabase Realtime Health Route

## Responsibility

Reports whether the configured Supabase Realtime WebSocket endpoint can complete a connection handshake.

## Design

- Runs in the Node.js runtime because the probe uses the built-in WebSocket client.
- Uses the configured Supabase URL and publishable/anon key to connect to `/realtime/v1/websocket`.
- Resolves healthy only after the socket emits `open`; connection errors, early close, invalid/missing configuration, and the 3-second timeout return degraded status.
- Closes the temporary socket and disables response caching. The key is sent only in the upstream connection URL and is never returned in the health payload.
- This is a service-reachability probe, not proof of database replication, channel authorization, or application-level subscription correctness.

## Flow

Resolve URL/key configuration → open an authenticated Realtime WebSocket → close after successful handshake or bounded failure → return `healthy`/`degraded`, safe reason code, latency, and timestamp.

## Integration

- Depends on the deployment-provided `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` and a public publishable/anon key.
- Exposed at `GET /api/health/supabase-realtime` for monitoring and deployment health checks.
