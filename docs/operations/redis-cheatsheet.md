# Redis Operational Cheat Sheet & Telemetry Runbook

Quick reference for Arch-System site engineers, control room operators, and developers diagnosing Redis operations, telemetry streams, and caching tiers.

---

## 1. Connection & Server Health

```bash
# Ping the active Redis instance
redis-cli -u $REDIS_URL ping

# Server overview and role
redis-cli -u $REDIS_URL info server

# Memory usage and fragmentation ratio
redis-cli -u $REDIS_URL info memory | grep -E "used_memory_human|used_memory_peak_human|mem_fragmentation_ratio"

# Active connected clients and connection pool status
redis-cli -u $REDIS_URL client list
redis-cli -u $REDIS_URL info clients
```

---

## 2. Telemetry Streams (`@repo/redis/streams.ts`)

Arch-System uses capped Redis Streams (`XADD MAXLEN ~ 5000`) for high-frequency Modbus SCADA and machine telemetry.

```bash
# Check stream length
redis-cli -u $REDIS_URL xlen telemetry:stream:PIT_VIPER_351_BIT_DEPTH

# Inspect stream metadata and consumer groups
redis-cli -u $REDIS_URL xinfo stream telemetry:stream:PIT_VIPER_351_BIT_DEPTH
redis-cli -u $REDIS_URL xinfo groups telemetry:stream:PIT_VIPER_351_BIT_DEPTH

# Read the last 5 telemetry points
redis-cli -u $REDIS_URL xrevrange telemetry:stream:PIT_VIPER_351_BIT_DEPTH + - count 5

# Check pending messages waiting for consumer acknowledgement (PEL)
redis-cli -u $REDIS_URL xpending telemetry:stream:PIT_VIPER_351_BIT_DEPTH scada_worker_group
```

---

## 3. Dual-Tier Cache Inspection & Invalidation

Arch-System utilizes a dual-tier cache (L1 LRU memory cache + L2 Redis cache) with scoped invalidation tags.

```bash
# Scan active cache tags (never use KEYS in production)
redis-cli -u $REDIS_URL --scan --pattern "tag:*" | head -n 20

# Check TTL of a specific cached route or tag
redis-cli -u $REDIS_URL ttl "dept:control-room:live_metrics"

# Inspect memory footprint of a large cached report
redis-cli -u $REDIS_URL memory usage "dept:control-room:shift_report:latest"

# Listen to live cache invalidation broadcasts
redis-cli -u $REDIS_URL psubscribe "cache:invalidate:*"
```

---

## 4. Distributed Locks (Redlock Primitives)

```bash
# Check active distributed locks (e.g. shift closeout, hourly aggregation)
redis-cli -u $REDIS_URL --scan --pattern "lock:*"

# Inspect lock owner and expiration TTL
redis-cli -u $REDIS_URL get "lock:shift_closeout:brakfontein_pit_1"
redis-cli -u $REDIS_URL pttl "lock:shift_closeout:brakfontein_pit_1"
```

---

## 5. Live Telemetry & Slow Log Debugging

```bash
# Live traffic sampling (use sparingly during active shifts)
redis-cli -u $REDIS_URL monitor

# View slowest executing commands (latency threshold > 10ms)
redis-cli -u $REDIS_URL slowlog get 10
redis-cli -u $REDIS_URL slowlog len
```

---

## 6. SCADA Telemetry Stream Inspection

Arch-System buffers incoming machine telemetry in capped Redis streams via `publishScadaTelemetryStream` (`@repo/redis/streams`).

```bash
# Automated inspection script (reads last 10 entries)
pnpm scada:stream

# Custom count inspection
bash scripts/inspect-scada-stream.sh 25

# Direct redis-cli inspection
redis-cli -u $REDIS_URL xrevrange "stream:telemetry:scada" + - COUNT 10

# Read stream length and verify approximate trimming (~5000 max length)
redis-cli -u $REDIS_URL xlen "stream:telemetry:scada"
```

---

## 7. Dragonfly Multi-Threaded Engine Profile

Arch-System's `@repo/redis` client is 100% wire-compatible with [Dragonfly](https://github.com/dragonflydb/dragonfly). Under high-volume SCADA operations (e.g. 100+ haul trucks streaming sensor metrics at 10Hz), Dragonfly can be deployed as a drop-in replacement for Redis:

- **Protocol Compatibility**: Full RESP2 and RESP3 wire compliance.
- **Zero Monorepo Changes**: Simply set `REDIS_URL=redis://<dragonfly-host>:6379`.
- **Throughput Advantage**: Multi-threaded shared-nothing architecture delivers up to 25x higher stream and cache ingestion throughput with sub-millisecond p99 latency.
