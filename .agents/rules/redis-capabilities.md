---
name: redis-capabilities
description: Which @repo/redis capability to use for caching, sessions, real-time data, rate limiting, analytics, distributed locks and vector search — and the invariants each one guarantees
paths:
  - 'packages/redis/**/*.{ts,tsx}'
  - 'packages/supabase/**/*.ts'
  - 'packages/rate-limiter/**/*.ts'
  - 'apps/portal/lib/**/*.ts'
  - 'apps/portal/server/**/*.ts'
  - 'apps/portal/app/api/**/*.ts'
---

# Redis 7.4 & Rate-Limiting Capability Contract

`@repo/redis` and `@repo/rate-limiter` are the only packages that talk to Redis. Application code (`apps/portal`, `libs/*`, `packages/supabase`) calls a named capability; it never issues raw commands (`GET`, `SET`, `EVAL`, `XADD`, `FT.SEARCH`, `INCR`, `SET NX`) and never assumes a persistent TCP socket — production may run on the Upstash HTTP REST transport (Vercel serverless), which cannot block, subscribe, or load native modules.

## 1. Capability-Only Façade

| Need                       | Use                                                                                                                       | Never                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| L1/L2 cache + X-Fetch      | `cacheWrap` (`cacheGetOrSet`) / `swrCacheWrap` / `cacheGet` / `cacheSet` / `cacheSetWithTags` (`cache.ts`, `adaptive.ts`) | `getRedisClient().get(...)` in apps |
| Dual-tier tag invalidation | `updateTag` / `updateTagInAction` / `updateTags` (`server-cache.ts`) → `cacheInvalidateTags` / `cacheInvalidatePrefixes`  | `SMEMBERS` + `DEL` or `KEYS *`      |
| Session state & revocation | `writeSession` / `readSession` / `touchSession` / `revokeSession` / `bumpPrivilegeVersion` (`session.ts`)                 | writing `arch:auth:employee:*` raw  |
| Streams & consumer groups  | `appendToStream` / `consumeStream` / `ensureConsumerGroup` / `claimIdle` / `moveToDeadLetter` / `readNew` (`streams.ts`)  | bare `XADD` + `XREAD` work queues   |
| Rate limiting              | `@repo/rate-limiter` (`FixedWindowStrategy`, `SlidingWindowStrategy`, `TokenBucketStrategy`, `RedisStore`, `MemoryStore`) | per-route counters with bare `INCR` |
| Counters / samples / ranks | `incrementCounter` / `incrWithExpire` / `recordSample` / `addUnique` / `addToLeaderboard` (`analytics.ts`)                | `GET` → parse → `SET`               |
| Locks & idempotency        | `withLock` / `tryWithLock` / `acquireLock` / `claimIdempotency` / `completeIdempotency` (`locks.ts`)                      | inline `SET NX` or in-memory `Map`  |
| Vector similarity search   | `ensureVectorIndex` / `upsertVector` / `searchVectors` (`search.ts`) with PostgreSQL `pgvector` fallback                  | `FT.SEARCH` without probing first   |

## 2. Dual-Transport Parity (TCP Redis 7.4 vs. Upstash HTTP REST)

- Every command rides `send` (throws `RedisCommandError`) or `sendSafe` (returns `null` on failure) in `raw.ts`, normalizing RESP2 and RESP3 replies (`asNumber`, `asStringOrNull`, `asFieldMap`, `parseStreamReply`, `asScoredMembers`, `asInfoMap`).
- `getRedisClient()` (`client.ts`) auto-detects HTTP(S) `REDIS_URL` or `UPSTASH_REDIS_REST_URL` / `SERVERLESS_REDIS_URL` / `KV_REST_API_URL` and wraps `ServerlessRedisClient` (`serverless-client.ts`: raw-string returns, 5 s `AbortSignal` deadline, 429/5xx-only retries, micro-batched `/pipeline` auto-pipelining, cursor-backed `scanIterator`/`sScanIterator`). Only `cache.ts` calls `JSON.parse`; `readMemory<T>` checks explicit presence so falsy values (`0`, `false`, `""`, `null`) are valid cache hits.
- Feature-detect, never guess: `detectCapabilities()` (cached 5 min) for `eval` / `streams` / `hyperLogLog` / `sortedSets` / `search` / `blocking`, `supportsBlockingReads()` before any `BLOCK` token, and `searchAvailability()` before vector queries.
- Locks, counters, samples, and rate limiters use atomic Lua when `EVAL` exists and guarded command fallbacks when it does not. Pub/Sub is best-effort only: local L1 is purged synchronously **before** any `cache:invalidate:broadcast` publish.

## 3. L1/L2 Caching, X-Fetch Stampede Protection & Dual-Tier Invalidation

- **L1 LRU + L2 Redis (`l1.ts`, `cache.ts`, `registry.ts`)**: `cacheGet` / `cacheGetWithStats` checks in-process L1 (`L1_MAX_ENTRIES = 1000`, O(1) `Map` recency bump) before L2 Redis. L1 TTL is computed by `l1TtlForKey(key, l2Seconds)` from `CACHE_TTL_REGISTRY` (`AUTH`, `METRICS`, `SHIFT`, `AI_MEMORY`, `DEPARTMENT`, `EQUIPMENT`), capped at `MAX_L1_TTL_SECONDS = 60`.
- **X-Fetch stampede protection (`cacheWrap` / `cacheGetOrSet`, `xfetch.ts`, `adaptive.ts`)**: Hot reads use `cacheWrap` (`cacheGetOrSet`), storing `XFetchWrapper<T>` (`{ value, ttl, delta, computedAt, __isXFetchWrapper: true }`) and evaluating `shouldEarlyExpire`: `-beta * delta * Math.log(u) > ttlRemaining` (`u = Math.max(Math.random(), Number.MIN_VALUE)`). Early-expiry refreshes and misses coalesce in-process via `activeFetches` and cross-instance via `acquireRefreshLease(key)` (`arch:lease:refresh:<key>`, released early via `releaseRefreshLease` on error). `swrCacheWrap` adds TinyLFU frequency decay, adaptive TTL (0.5x–3x ±10% jitter), `redisCircuitBreaker`, and 15 s negative caching.
- **Durability & invalidation (`invalidation.ts`, `apps/portal/lib/server-cache.ts`)**: `write-through-durable` categories use `cacheWriteThroughSupabase` + `registerSupabaseFallback`. Mutations call `updateTag()` / `updateTagInAction()` / `updateTags()` **before** `redirect()`, clearing Next.js Data Cache and Redis L1/L2 via `cacheInvalidateTags` (`sScanIterator` + `UNLINK` on `arch:__tags__:<tag>`, synchronous local L1 `memoryDeleteKeys` before broadcast capped at `BROADCAST_KEY_LIMIT = 1000`). Telemetry in `stats.ts` buffers in a `Float64Array` ring buffer and flushes in batches (`flushStats`, `persistCacheStatsSnapshot`).

## 4. Atomic Lua Rate Limiting & Distributed Locks

- **Rate limiting (`@repo/rate-limiter` & `rate-limit-middleware.ts`)**: `RateLimiter` pairs `RedisStore` (with automatic `MemoryStore` fallback on error) with `FixedWindowStrategy` (`FIXED_WINDOW_LUA_SCRIPT`: atomic `INCR` + `PTTL`/`PEXPIRE` repair on `<key>:fixed:<windowStart>`), `SlidingWindowStrategy` (`SLIDING_WINDOW_LUA_SCRIPT`: `cjson` timestamp pruning + `SET EX` on `<key>:sliding`), or `TokenBucketStrategy` (`LUA_TOKEN_BUCKET`: continuous refill + weighted deduction on `<key>:tokenbucket`), each falling back to `get`/`set` when `eval` is unavailable. HTTP routes use `withRateLimit` / `checkRateLimit` (backed by `incrWithExpire`, scoped to `ratelimit:<path>:ip:<ip>`, CPU-load adaptive >85%, emitting RFC 9210 `RateLimit`/`RateLimit-Policy` and `X-RateLimit-*` headers).
- **Distributed locks & idempotency (`locks.ts`)**: Every lock carries a TTL (`SET arch:lock:<name> <token> NX PX <ttlMs>`); `withLock` releases in `finally` and renews at `ttlMs / 3` (min 1 s) when `autoRenew: true`. Release (`RELEASE_SCRIPT`) and renewal (`RENEW_SCRIPT`) use token-verified Lua (`OWNED_BY_TOKEN_LUA`) with guarded `GET` + `DEL`/`PEXPIRE` fallback; `releaseLock` returns `false` if ownership was lost. Pass `fencing: true` (`ACQUIRE_FENCE_SCRIPT`) for monotonic `fencingToken`s. Contention returns `null` (`tryWithLock`) or throws `LockUnavailableError` (`withLock`); a `RedisCommandError` from `acquireLock` fails closed. Replay-safe writes pair with `claimIdempotency` (`'new' | 'in-flight' | 'duplicate'`), `completeIdempotency`, `readIdempotencyResult`, and `abandonIdempotency`.

## 5. Sessions, Streams, Analytics, Vector Search, Keys & Testing

- **Sessions (`session.ts`)**: One `EmployeeRecord` shape under `sessionKey(userId, options)`. Revocation is `bumpPrivilegeVersion` (single `INCR` on `arch:auth:privilege:<userId>` + `DEL` + L1 delete); call `revokeSession` on logout or role/department change. Sliding expiry uses `GETEX` (`touchSession`, throttled to 60 s). `readSession` checks L1 first — tests must delete via `cacheDelete`/`revokeSession`.
- **Streams (`streams.ts`)**: Work queues use `consumeStream` (`ensureConsumerGroup` → `claimIdle` via `XAUTOCLAIM` → `readFromGroup` → `acknowledge` or `moveToDeadLetter` to `<stream>:dead` after `maxDeliveries`). Always pass `maxLen` to `appendToStream`. SSE readers use `readNew` with `Last-Event-ID`.
- **Analytics (`analytics.ts`)**: `incrementCounter` / `incrWithExpire` (`INCR_WITH_TTL_SCRIPT`), `recordSample` (`RECORD_SAMPLE_SCRIPT`), `addUnique` (`PFADD`), and `addToLeaderboard` (`ZINCRBY`) are atomic, time-bucketed with retention TTLs for `allkeys-lru`, and degrade to `0`/`null`/`[]` via `sendSafe`.
- **Vector search (`search.ts`)**: `ensureVectorIndex` → `upsertVector` → `searchVectors` (`DIALECT 2`), gated by `searchAvailability()`. Pack vectors with `encodeVector(Float32Array)` and share one `VectorIndexSpec`. Unavailable or rejected queries return `[]` to trigger the PostgreSQL `pgvector` fallback.
- **Key hygiene & testing**: Fixed prefixes (`arch:lock:`, `arch:idem:`, `arch:lease:refresh:`, `arch:auth:employee:`, `arch:auth:privilege:`, `arch:metrics:{ctr,sample,hll,rank}:`, `arch:__tags__:`, `arch:vector:`, `ratelimit:`, `drilling:telemetry:stream`) built via module helpers (`buildCacheKey`, `lockKey`, `sessionKey`, `refreshLeaseKey`, `vectorKey`), always TTL'd or trimmed. Unit tests mock `client`/`raw` (asserting both Lua and fallback paths); real-server parity runs via `REDIS_INTEGRATION=1 pnpm --filter @repo/redis test:integration` using per-run token `SCAN`+`UNLINK` cleanup (never `FLUSHDB`).
