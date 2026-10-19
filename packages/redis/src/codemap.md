# packages/redis/src/

## Responsibility

Implementation of the hybrid L1/L2 cache described in `../codemap.md`.
Invariants enforced here:

1. **Single JSON decode boundary.** `client.ts` and `serverless-client.ts`
   return raw Redis strings; only `cache.ts` decodes. Adding a `JSON.parse` to
   either transport reintroduces the double-decode defect.
2. **Presence-based hit detection.** `0`, `false`, `""` and `null` are values,
   not misses.
3. **Hot-path purity.** `recordCacheHit` / `recordCacheMiss` buffer only; all
   Redis I/O happens in `flushStats`.
4. **Non-blocking keyspace work.** SCAN/SSCAN + UNLINK only.
5. **Bounded resources.** Timeouts, retries, L1 capacity, frequency and dedupe
   trackers are all capped.

## Design

`l1.ts` is the only module that mutates the in-memory store, which is what lets
`invalidation.ts` purge L1 without importing `cache.ts` (avoiding a cycle).

`serverless-client.ts` exposes a `command()` escape hatch so the node-redis
compatibility adapter in `client.ts` can reach commands without a dedicated
helper.

Upstash returns `{ result }` for single commands but a **bare array** for
`/pipeline`; `pipeline()` normalises both shapes.

## Flow

See `../codemap.md`. Module-level entry points are `cache.ts` (data plane) and
`invalidation.ts` (control plane).

## Integration

Consumed through `@repo/redis` and `@repo/redis/cache`. Tests are hermetic:
keys are unique per run and cleaned up, because `clearMemoryCache()` only
resets L1 and fixed keys would otherwise leak into the shared Redis instance.
