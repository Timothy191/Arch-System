# packages/redis/

## Responsibility

Capability layer for every Redis use in the platform: a process-local **L1**
cache in front of a distributed **L2** Redis (or Upstash REST) datastore, plus
authorization sessions, stream/consumer-group real-time data, distributed locks
and idempotency claims, atomic analytics, RediSearch vector search, and the
transport probe that decides which of those are legal on this endpoint.

No business logic lives here. This package is infrastructure consumed by
`libs/shared/utils`, `packages/supabase`, `packages/rate-limiter`, and
`apps/portal`.

## Design

| Module                 | Job                                                                                                                                                                                                                                    |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`            | Singleton connection factory. Auto-detects HTTP(S) `REDIS_URL` and routes to the REST adapter. Wraps `ServerlessRedisClient` in the node-redis surface.                                                                                |
| `serverless-client.ts` | Upstash REST transport. Raw-string semantics, bounded timeouts, bounded retries, micro-batched auto-pipelining.                                                                                                                        |
| `raw.ts`               | Transport façade for commands the node-redis surface does not mirror (`EVAL`, streams, HLL, ZSET, `GETEX`, module probes). `send` throws, `sendSafe` degrades; tolerant RESP2/RESP3 parsers and a cached `detectCapabilities()` probe. |
| `l1.ts`                | The L1 store: TTL + **true LRU**. Extracted so `cache.ts` and `invalidation.ts` share it without a cycle.                                                                                                                              |
| `cache.ts`             | Read/write/invalidate API over L1 + L2. Owns the **single JSON decode boundary**.                                                                                                                                                      |
| `registry.ts`          | Per-category TTL policy (`l1Seconds` / `l2Seconds`) and key construction.                                                                                                                                                              |
| `invalidation.ts`      | Tag (SSCAN) and prefix (SCAN) invalidation using non-blocking UNLINK, plus the bounded cross-instance broadcast.                                                                                                                       |
| `session.ts`           | Cached `EmployeeRecord` for RBAC, keyed by user (+ optional session id), stamped with a privilege version; revocation is one `INCR`. Sliding expiry via `GETEX`.                                                                       |
| `locks.ts`             | `SET NX PX` locks with TTL ownership, compare-and-delete release, compare-and-pexpire renewal, monotonic fencing tokens, refresh leases, and idempotency claims.                                                                       |
| `streams.ts`           | Capped streams (`XADD MAXLEN`), consumer groups, acknowledgement, `XAUTOCLAIM` of idle work, dead-letter stream, and the `consumeStream` retry loop.                                                                                   |
| `analytics.ts`         | Bucketed counters (`INCR` + `TTL` in one script), count/sum/max samples, HyperLogLog uniques, ZSET leaderboards.                                                                                                                       |
| `search.ts`            | RediSearch `FT.CREATE` / `FT.HSET` / `FT.SEARCH` k-NN with filter + `PARAMS`; gated by `searchAvailability()`, empty result means "use pgvector".                                                                                      |
| `adaptive.ts`          | TinyLFU frequency, adaptive TTL + avalanche jitter, circuit breaker, SWR wrapper.                                                                                                                                                      |
| `xfetch.ts`            | XFetch probabilistic early expiration decision.                                                                                                                                                                                        |
| `stats.ts`             | Batched, buffered cache telemetry.                                                                                                                                                                                                     |

### Invariants

1. **One decode boundary.** Both transports return raw Redis strings. Only
   `cache.ts` calls `JSON.parse`. The REST client must never decode.
2. **Presence, not truthiness.** A cached `0`, `false`, `""` or `null` is a
   hit. Hit detection uses explicit `null`/`undefined` comparison.
3. **Observability never sits on the hot path.** `stats.ts` buffers locally and
   flushes in one batched round-trip; it must never issue per-call Redis I/O.
4. **Never block Redis.** Use SCAN/SSCAN, never KEYS/SMEMBERS; UNLINK, never
   blocking DEL, for bulk invalidation.
5. **Local invalidation is unconditional.** L1 is purged before any broadcast,
   so correctness never depends on Pub/Sub (unavailable over REST).
6. **Bounded everything.** Every request has a deadline; retries are capped;
   L1, frequency, and dedupe trackers are all bounded; every key is TTL'd or
   trimmed, because the instance is `allkeys-lru`.
7. **Capability, not assumption.** Blocking reads, Lua, streams, HLL, ZSET and
   search are probed through `raw.ts` (`detectCapabilities`,
   `supportsBlockingReads`, `searchAvailability`) and each has a non-scripted
   fallback where the semantics allow one.
8. **Coordination primitives fail loudly, analytics fail softly.** Losing a
   lock, or a `RedisCommandError` from `acquireLock`, must surface (contended
   writes would otherwise proceed without exclusivity); a counter or sample miss
   returns `0`/`null` instead of failing a request.
9. **Ownership is checked, not trusted.** Release and renew are
   compare-and-delete / compare-and-pexpire, so a holder whose lock already
   expired cannot touch the new owner's key; sessions are validated against the
   privilege version on read, so one bump invalidates every cached copy.

## Flow

```
cacheGet(key)
  ├─ L1 read (l1.ts)  ──────────────── hit → return
  └─ L2 read (client) ─────────────── miss → decode once → promote to L1
```

`cacheWrap` adds XFetch early expiration and Single-Flight coalescing on top.
`swrCacheWrap` additionally serves stale data while revalidating in background.

The coordination paths, each ending in a single command or one Lua script:

```
withLock / tryWithLock ── SET NX PX ──▶ fn(handle) ──▶ compare-and-delete
claimIdempotency       ── SET NX EX ──▶ 'new' | 'in-flight' | 'duplicate'
consumeStream          ── XAUTOCLAIM ─▶ XREADGROUP ─▶ handler ─▶ XACK
                                        └─ over maxDeliveries ─▶ XADD :dead + XACK
readSession            ── GET version + cacheGet record ─▶ version match or null
incrementCounter       ── EVAL INCRBY+PEXPIRE ─▶ (fallback: INCRBY + EXPIRE)
searchVectors          ── FT.SEARCH … [KNN k @vec $VEC] DIALECT 2 ─▶ [] or hits
```

## Integration

- Imported as `@repo/redis` or the `@repo/redis/{cache,client,session,search,analytics,raw}` subpaths.
- Downstream: `libs/shared/utils/cache-utils` (`withCache`), portal rate
  limiting, shift closeout (lock + idempotency), telemetry ingest (streams +
  SSE replay), offline sync fallback (idempotent replay), `packages/supabase`
  auth (session write on login), SCADA tag routes, health probes.
- `apps/portal` must not import `packages/database` — it reaches Redis through
  this package only.
- Set `REDIS_STATS_DISABLED=true` to keep counters fully in-process.
- Tests: `tests/*.test.ts` mock the transport (`client` + `raw`);
  `tests/integration/redis-capabilities.integration.test.ts` runs against a real
  server and is skipped unless `REDIS_INTEGRATION=1`
  (`pnpm --filter @repo/redis test:integration`, CI job `redis-integration`).
  For the search path, run a Redis Stack image
  (`infra/docker/compose.redis-stack.yml`); plain `redis:*-alpine` reports
  `no-search-module` and those cases no-op by design.
