# Runbook: Redis Outage in Control Room

**Severity:** Medium
**Impact:** `scada-status` hysteresis and fast-fallback telemetry caching will degrade.

## Symptoms

- `redis_connected` attribute is false in OpenTelemetry.
- Alert: `ControlRoomRedisCacheOffline` fires.

## Actions

1. Check ElastiCache / MemoryDB cluster status.
2. If Redis is down, the system natively falls back to direct SCADA HTTP queries.
3. No immediate data loss. Scale up Redis or restart nodes.
