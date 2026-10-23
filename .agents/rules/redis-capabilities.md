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

# Redis Capability Map

`@repo/redis` is the only place that talks to Redis. Application code calls a named
capability; it never issues a raw command, and it never assumes a persistent
socket — production may run on the Upstash-style REST transport, which cannot
block, subscribe, or run modules.

## 1. Pick the capability, do not hand-roll the command

| Need                                        | Use                                                                                                                       | Never                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Read-through cache, tag/prefix invalidation | `cacheGet` / `cacheSet` / `cacheWrap` / `cacheInvalidateTags` / `cacheInvalidatePrefixes` (`cache.ts`, `invalidation.ts`) | `getRedisClient().get(...)` in a route or action |
| Authorization session state                 | `writeSession` / `readSession` / `touchSession` / `revokeSession` (`session.ts`)                                          | writing `arch:auth:employee:*` by hand           |
| Work queue / live events                    | `appendToStream` / `consumeStream` / `readNew` (`streams.ts`)                                                             | bare `XADD` + `XREAD` pairs                      |
| Rate limiting                               | `@repo/rate-limiter` with `RedisStore`, plus `rate-limit-middleware.ts` for HTTP                                          | per-route counters built with `INCR`             |
| Live counters / uniques / leaderboards      | `incrementCounter` / `recordSample` / `addUnique` / `addToLeaderboard` (`analytics.ts`)                                   | `GET` → parse → `SET` read-modify-write          |
| Coordinated writes across instances         | `withLock` / `tryWithLock` / `claimIdempotency` (`locks.ts`)                                                              | `SET NX` written inline                          |
| Similarity search                           | `searchVectors` (`search.ts`) with a pgvector fallback                                                                    | calling `FT.SEARCH` without probing availability |

## 2. Transport rules

- Every new command goes through `send` / `sendSafe` in `raw.ts`
  (`send` throws `RedisCommandError`, `sendSafe` degrades to a nullish reply).
  Both tolerate RESP2 and RESP3 reply shapes.
- Feature-detect, never guess: `detectCapabilities()` for
  `eval` / `streams` / `hyperLogLog` / `sortedSets` / `search` / `blocking`,
  and `supportsBlockingReads()` before any `BLOCK` argument. `searchAvailability()`
  gates the whole vector path.
- Anything that must work on serverless Redis needs a non-scripted fallback.
  Locks, counters and samples use Lua when `EVAL` exists and a guarded single
  command when it does not. Pub/Sub is best-effort only: L1 is purged locally
  **before** any broadcast, so correctness never depends on delivery.

## 3. Locks and idempotency invariants

- Every lock carries a TTL; `withLock` releases in `finally` and renews at
  `ttlMs / 3` (floored at one second) when `autoRenew` is set.
- Release and renew are compare-and-delete / compare-and-pexpire: a holder that
  lost ownership cannot touch another holder's key, and `releaseLock` returns
  `false` rather than lying.
- Contention is a return value, not an exception: `tryWithLock` yields `null`,
  `withLock` throws `LockUnavailableError`. Writers that must not queue pair it
  with `claimIdempotency` (`'new'` / `'in-flight'` / `'duplicate'`) and store the
  result with `completeIdempotency` so a replay returns the original outcome.
- Pass `fencing: true` when a stale holder can still reach a datastore; the
  token is monotonic per key and must be forwarded downstream.
- A `RedisCommandError` from `acquireLock` means "Redis is unreachable" — it
  must never be swallowed into a proceed-anyways path.

## 4. Sessions

- One record shape (`EmployeeRecord`) under `sessionKey(userId, options)`;
  multi-device sessions pass `sessionId`.
- Revocation is `bumpPrivilegeVersion` (a single `INCR`), which invalidates every
  stored copy on every instance without SCAN or Pub/Sub. Call it on logout and
  whenever role, department, or access list changes.
- Sliding expiry uses `GETEX` (`touchSession`), throttled per process — do not
  re-issue `SET` on every navigation.
- `readSession` serves L1 first: tests that assert "the session is gone" must
  delete through `cacheDelete`/`revokeSession`, not `client.del` on the L2 key.

## 5. Streams

- A work queue is a consumer group: `ensureConsumerGroup` → `readFromGroup` →
  `acknowledge`, with `claimIdle` to rescue entries from a dead consumer and
  `moveToDeadLetter` after `maxDeliveries`. `consumeStream` drives that loop;
  call it instead of assembling the pieces.
- Append with `maxLen` (and `approx: false` when the cap must hold exactly);
  an unbounded stream in a memory-limited instance is a future eviction.
- Unacknowledged entries stay pending and are never lost; a handler signals
  failure by throwing, and the loop counts it (`{ processed, failed, dead }`)
  instead of dropping it.
- SSE/broadcast readers use `readNew` with `Last-Event-ID` replay; queue
  consumers never read the same stream with `XREAD`.

## 6. Analytics are atomic and self-limiting

- Increments are `INCR` + `TTL` in one script, samples are one hash update,
  uniques are HyperLogLog, rankings are ZSET — no read-modify-write anywhere.
- Keys are bucketed by time and carry a TTL, because the instance is
  `allkeys-lru`: an unpinned counter is the first thing evicted, and a counter
  without a window is a memory leak.
- Analytics must never fail a request: `sendSafe` paths return `0`/`null` when
  Redis is unreachable, and callers render "no data" instead of erroring.

## 7. Vector search

- `ensureVectorIndex` → `upsertVector` → `searchVectors`, all short-circuiting on
  `searchAvailability()`. An unavailable or rejected query returns `[]`, which
  means "fall back to pgvector", not "there is nothing similar".
- Vectors are packed as little-endian float32 via `encodeVector`; a JSON array
  is silently a different encoding and produces garbage scores, not an error.
- Index names and key prefixes come from one `VectorIndexSpec` so the index
  prefix and the document prefix cannot drift apart.

## 8. Key hygiene

- Namespacing is fixed: `arch:lock:` · `arch:idem:` · `arch:lease:refresh:` ·
  `arch:auth:employee:` / `arch:auth:privilege:` · `arch:metrics:{ctr,hll,rank}:` ·
  `arch:__tags__:` · `arch:vector:`. Streams are the one exception and carry
  their domain name (`drilling:telemetry:stream`).
- Every key is either TTL'd or trimmed. Keys with no bound fail review.
- Build keys with the module's own helpers (`lockKey`, `sessionKey`,
  `refreshLeaseKey`, `vectorKey`); never interpolate a prefix by hand.

## 9. Testing

- Unit suites mock at the **transport** boundary (`../src/client`, `../src/raw`)
  and assert the exact command tokens, including the no-`EVAL` fallback path.
- Real-server behaviour is covered by
  `packages/redis/tests/integration/redis-capabilities.integration.test.ts`
  (`REDIS_INTEGRATION=1 pnpm --filter @repo/redis test:integration`, CI job
  `redis-integration`): lock ownership and expiry, fencing monotonicity, claim
  states, session revocation, concurrent counter exactness, consumer-group
  split/claim/dead-letter, tag invalidation, and k-NN when a search module is
  present. New primitives get both halves — a mocked suite proves the command,
  an integration test proves the server honours it.
- Integration keys carry a per-run token and are `SCAN`+`UNLINK`ed afterwards;
  never `FLUSHDB` on a shared instance.
