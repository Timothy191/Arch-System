# `@repo/redis`

Production-grade L1/L2 caching, distributed locking, streams, and observability for Arch-System.

## 1. Key Naming & Cluster Hash Tags

- Format: `arch:<category>:<entity>:<id>:<attribute>` via `buildCacheKey`.
- Overlong segments (>64B) or keys (>256B) are normalized and SHA-256 suffixed via `normalizeKeySegment`.
- Multi-key operations in Redis Cluster must co-locate slots using `{slotTag}` via `buildClusterSlotKey` and validate with `assertSameSlot`.

## 2. Data Structure Decision Table

| Structure       | When to Use                                      | Helpers                                                      |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| **String**      | Whole serialized entities with uniform TTL       | `cacheGet`, `cacheSet`, `getOrSet`                           |
| **Hash**        | Partial field reads/writes (e.g. session fields) | `cacheHashSetFields`, `cacheHashGetField`, `cacheHashGetAll` |
| **Stream**      | Durable event fan-out & consumer groups          | `streamAdd`, `streamReadGroup`, `streamAck`                  |
| **HyperLogLog** | Approximate unique cardinality at scale          | `pfAdd`, `pfCount`, `pfMerge`                                |
| **Bitmap**      | Compact boolean flags per numeric offset         | `setBitFlag`, `getBitFlag`, `bitCountRange`                  |
| **Sorted Set**  | Leaderboards & time/score-ordered ranges         | `zadd`, `zrange`, `zrank`                                    |

## 3. Read-Through (`getOrSet`) Guarantees

- **Stampede protection**: In-process single-flight coalescing + distributed `SET NX PX` lock (`acquireLock`) + Lua `EVALSHA` compare-and-delete (`releaseLock`).
- **Penetration protection**: Caches `NULL_SENTINEL` for `negativeTtl` (default 60s, max 300s) when fetcher returns `null`/`undefined`.
- **Avalanche protection**: Default TTL jitter (`applyTtlJitter`) and 24h ceiling (`MAX_TTL_SECONDS`).

## 4. Pipelining

Use `runPipeline(commands, { batchSize: 100 })` to batch mutations (such as `UNLINK` invalidations) into chunked round-trips with automatic single retry.

## 5. Security & Denylist

- SDK layer (`raw.ts`): `KEYS`, `FLUSHALL`, `FLUSHDB`, `CONFIG`, `SHUTDOWN`, and `DEBUG` are rejected unless `{ allowDangerous: true }` is explicitly passed.
- Infra layer (`infra/redis/acl/users.acl.example`): Least-privilege `arch_cache` ACL user scoped to `~arch:* ~lock:* ~cache:*` with dangerous commands disabled.
