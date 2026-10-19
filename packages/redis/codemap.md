# packages/redis/

## Responsibility

Hybrid cache layer for the platform: a process-local **L1** cache in front of a
distributed **L2** Redis (or Upstash REST) datastore, plus the supporting
machinery — TTL registry, tag/prefix invalidation, cache statistics, XFetch
probabilistic early expiration, and the Single-Flight / SWR adaptive engine.

No business logic lives here. This package is infrastructure consumed by
`libs/shared/utils`, `packages/supabase`, and `apps/portal`.

## Design

| Module                 | Job                                                                                                                                                     |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `client.ts`            | Singleton connection factory. Auto-detects HTTP(S) `REDIS_URL` and routes to the REST adapter. Wraps `ServerlessRedisClient` in the node-redis surface. |
| `serverless-client.ts` | Upstash REST transport. Raw-string semantics, bounded timeouts, bounded retries, micro-batched auto-pipelining.                                         |
| `l1.ts`                | The L1 store: TTL + **true LRU**. Extracted so `cache.ts` and `invalidation.ts` share it without a cycle.                                               |
| `cache.ts`             | Read/write/invalidate API over L1 + L2. Owns the **single JSON decode boundary**.                                                                       |
| `registry.ts`          | Per-category TTL policy (`l1Seconds` / `l2Seconds`) and key construction.                                                                               |
| `invalidation.ts`      | Tag (SSCAN) and prefix (SCAN) invalidation using non-blocking UNLINK.                                                                                   |
| `adaptive.ts`          | TinyLFU frequency, adaptive TTL + avalanche jitter, circuit breaker, SWR wrapper.                                                                       |
| `xfetch.ts`            | XFetch probabilistic early expiration decision.                                                                                                         |
| `stats.ts`             | Batched, buffered cache telemetry.                                                                                                                      |

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
   L1, frequency, and dedupe trackers are all bounded.

## Flow

```
cacheGet(key)
  ├─ L1 read (l1.ts)  ──────────────── hit → return
  └─ L2 read (client) ─────────────── miss → decode once → promote to L1
```

`cacheWrap` adds XFetch early expiration and Single-Flight coalescing on top.
`swrCacheWrap` additionally serves stale data while revalidating in background.

## Integration

- Imported as `@repo/redis` or the `@repo/redis/cache` subpath.
- Downstream: `libs/shared/utils/cache-utils` (`withCache`), portal rate
  limiting, shift closeout, telemetry, SCADA tag routes, health probes.
- `apps/portal` must not import `packages/database` — it reaches Redis through
  this package only.
- Set `REDIS_STATS_DISABLED=true` to keep counters fully in-process.
