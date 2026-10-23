## [2026-09-01T06:25:22Z] System Diagnostics & Dependency Audit

- **Agent**: Antigravity
- **Summary**: Conducted a full system health check, dependency optimization, and compliance audit. Unused packages were pruned, dead code removed, and syncpack highest-semver mismatches (e.g., @repo/logger in @repo/supabase) were resolved. Evaluated system using pnpm type-check, deps:check, and lint.
- **Handoff**: Repository is fully green. All compliance checks passing. Ready for next feature development or architectural drill-down.

## [2026-10-16T06:42:00+02:00] Serverless Redis Type Fix & HTTP REST Protocol Adapter

- **Agent**: Antigravity
- **Summary**: Fixed `TS2693` in `src/serverless-client.ts` by replacing the invalid value-level type literal with `UpstashRestResponse` interface and adding `ping()`. Updated `src/client.ts` (`getRedisClient`) to route HTTP/HTTPS `REDIS_URL` or Vercel Upstash REST configurations through `ServerlessRedisClient` instead of `node-redis` TCP sockets, preventing `"Invalid protocol"` health probe failures in serverless deployments.
- **Handoff**: `@repo/redis` type-checks and unit tests pass cleanly.

## [2026-10-19T00:00:00+02:00] Redis Layer Audit, Root-Cause & Remediation

- **Agent**: Antigravity
- **Scope**: `packages/redis` only. No consumer files changed; all downstream
  tests pass unchanged.
- **Summary**: Audited the hybrid L1/L2 cache, confirmed five defects against
  running code and a live Upstash instance, then fixed them.

### Findings (all reproduced before fixing)

1. **P0 — Serverless L2 reads were 100% broken.** `ServerlessRedisClient.get()`
   decoded JSON _and_ `cache.ts` decoded again, so every REST read threw
   `"[object Object]" is not valid JSON`, was swallowed, and returned `null`.
   Every Upstash/Vercel cache read was a permanent miss.
2. **P0 — Falsy values were unreadable.** `if (value)` / `!== null` turned
   cached `0`, `false`, `""` and `null` into misses on _both_ transports.
3. **P0 — Serverless adapter surface gap.** `scan`, `hIncrBy`, `lPush`,
   `lTrim`, `lRange` were absent (`TypeError` at the call site);
   `set(k, v, { EX })` dropped the TTL (permanent keys); `scanIterator` and
   `sScanIterator` were **empty async generators**, so prefix and tag
   invalidation silently deleted **zero** keys on every serverless deployment.
4. **P0 — 4 billable Redis commands per cache hit.** `stats.ts` issued
   `HINCRBY`×2 + `LPUSH` + `LTRIM` on every read, including sub-millisecond L1
   hits that never touched Redis — inverting the latency L1 exists to avoid and
   billing 4× per read on Upstash.
5. **P1 — `connecting` promise poisoning.** A rejected `connect()` stayed
   assigned at module scope, so every later `getRedisClient()` in the process
   received the same permanently rejected promise. Also fixed: FIFO-not-LRU
   eviction, unbounded `lastDedupedTimes` leak, `closeRedis()` not clearing the
   in-flight slot, and L1 not purged when Pub/Sub is unavailable.

### Additional defect found while verifying

`pipeline()` assumed Upstash wraps `/pipeline` responses in `{ result: [...] }`.
Upstash returns a **bare array**. Both the old and first-draft implementations
threw `unexpected response`, which would have broken tag indexing. Now
normalised for both shapes.

### Fixes

- `l1.ts` extracted: true LRU, bounded, shared by cache + invalidation layers.
- Single decode boundary; presence-based reads; registry `l1Seconds` now
  actually applied (it was dead config).
- REST client: raw-string `get`/`hget`, request timeouts, capped retries on
  429/5xx only, micro-batched auto-pipelining (verified: 25 commands → 1 HTTP
  request), full command coverage including real SCAN/SSCAN cursors.
- `stats.ts`: buffered telemetry, O(1) ring buffer replacing `Array#shift`,
  `unref()`'d interval flush, `REDIS_STATS_DISABLED` opt-out.
- `invalidation.ts`: L1 purged unconditionally _before_ broadcasting.
- XFetch preserved (matches the VLDB paper); added the `rand() > 0` guard.
- Tests made hermetic: the suite wrote fixed keys to the configured live
  Upstash database, so it passed on a cold DB and failed on every later run.
  This was pre-existing — verified by reproducing it on unmodified `main`.

### Verification

- `@repo/redis`: 41/41 tests, stable across repeated runs; `tsc --noEmit` clean;
  `biome check` clean.
- `portal` type-check clean; 68 Redis-consuming portal tests pass.
- Live end-to-end smoke against the configured Upstash REST endpoint: 12/12
  checks pass (adapter surface, object round-trip, falsy values, `{EX}` TTL
  honoured, tag + prefix invalidation deleting real keys).
- **Handoff**: Ready for review. Consumers required no changes.

## [2026-10-19T12:00:00+02:00] Redis 7.4 Architecture Hardening, Durability Boundary & Cache Stats Persistence

- **Agent**: Antigravity
- **Summary**:
  1. Implemented `DurabilityPolicy`, `isDurableKey()`, `assertDurabilityBoundary()`, `registerSupabaseFallback()`, `resolveSupabaseFallback()`, and `cacheWriteThroughSupabase()` across `src/{registry,cache,index}.ts` to enforce zero business-critical data stored solely in Redis without a Supabase SSoT fallback.
  2. Added `persistCacheStatsSnapshot()` and `registerStatsPersistenceSink()` in `src/stats.ts` so cache metrics survive process/container restarts.
  3. Enhanced `src/client.ts` REST auto-detection (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SERVERLESS_REDIS_URL`, `KV_REST_API_URL`) and added `tests/xfetch-durability.test.ts` validating the X-Fetch probabilistic early-expiration formula and 100-concurrency single-flight stampede protection.
- **Verification**: `@repo/redis` 6/6 test suites (48/48 tests PASS), `pnpm agent:verify` PASS.

## [2026-10-23T11:37:00+02:00] Redis Enterprise Primitives Test Coverage & Async Processing ADR

- **Agent**: Antigravity (Principal Software Architect)
- **Summary**:
  1. Authored comprehensive, hermetic unit test suites for the 5 enterprise Redis modules:
     - `tests/raw.test.ts`: Transport switching (`currentTransport`), typed RESP array deserialization, stream payload parsing, and safe execution (`send`, `sendSafe`).
     - `tests/session.test.ts`: Session privilege version fencing, atomic invalidation (`bumpPrivilegeVersion`), sliding expiration (`touchSession` with `GETEX`), and session revocation.
     - `tests/locks.test.ts`: Distributed locks with Lua ownership release, fencing token monotonicity, lock renewal, `withLock`/`tryWithLock`, idempotency lifecycle (`claimIdempotency`, `completeIdempotency`, `abandonIdempotency`), and single-flight refresh leases.
     - `tests/analytics.test.ts`: Atomic counters with multi-window bucketing, latency sample summaries (`recordSample`, `readSample`), ZSET leaderboards, and HyperLogLog cardinality (`addUnique`, `estimateUnique`).
     - `tests/streams.test.ts`: Stream appending with length capping (`MAXLEN ~`), consumer groups, acknowledgment (`XACK`), pending inspection (`XPENDING`), idle message reclamation (`claimIdle`), and DLQ routing (`moveToDeadLetter`).
  2. Codified `ADR-012: Asynchronous Processing & Event-Driven Topology` defining strict runtime and architectural boundaries across Redis Streams, PostgreSQL Outbox, and Inngest workflows.
- **Verification**: `@repo/redis` 11/11 test suites passing (111/111 tests PASS); `pnpm type-check` PASS; `pnpm agent:verify` 100% PASS.

## [2026-10-23T12:34:38+02:00] Object-input capability APIs, vector + invalidation suites, real-server integration gate

- **Agent**: Qoder
- **Summary**:
  1. Collapsed multi-argument capability calls into single object inputs so they satisfy the `max-params` agent rule: `withLock`/`tryWithLock({ name, ttlMs, … }, fn)`, `completeIdempotency({ key, result, ttlSeconds })`, `appendToStream`/`ensureConsumerGroup`/`readFromGroup`/`acknowledge`/`readPending`/`claimIdle`/`moveToDeadLetter`/`consumeStream` (`GroupRef`/`ConsumerRef` plus per-call options), `writeSession({ userId, employee })`, `recordSample`/`addUnique`/`addToLeaderboard`. Input types (`LockRunInput`, `IdempotencyCompletion`, `WriteSessionInput`, `AutoClaimResult`, stream refs) are exported from `index.ts`.
  2. Named every literal in `raw.ts`, `locks.ts`, `session.ts`, `analytics.ts`, `search.ts`, `invalidation.ts` (`CAPABILITY_TTL_MS`, `LOCK_ABSENT`, `IDEMPOTENCY_TTL_SECONDS`, `SESSION_ABSENT`, `MIN_TTL_SECONDS`, `BROADCAST_KEY_LIMIT`, …) and reshaped `RedisCommandError` to `(command, { message, cause })`.
  3. Added `tests/search.test.ts` (20 cases: availability reasons, little-endian float32 packing, `FT.CREATE`/`FT.SEARCH`/`FT.INFO`/`FT.DROPINDEX` tokens, RESP2 and RESP3 replies, rejection ⇒ `[]`) and `tests/invalidation.test.ts` (10 cases: tag pipeline with SSCAN + UNLINK, L1 purge ordering, broadcast envelope and the 1 000-key cap, unreachable client), plus a `consumeStream` loop suite (acknowledge / handler failure / dead-letter) in `tests/streams.test.ts` → 13 suites, 144 tests.
  4. Added `tests/integration/redis-capabilities.integration.test.ts` with `jest.integration.config.cjs` and the `test:integration` script (skipped unless `REDIS_INTEGRATION=1`, excluded from the unit run): 27 real-server cases — lock grant, contention, foreign release/renew rejection, TTL expiry, fencing monotonicity, `autoRenew` surviving its own TTL, single guarded writer among eight; idempotency claim states and concurrent-replay single execution; session write→read→touch→delete, privilege bump across devices; 25-way concurrent counter exactness, dimension split, sample aggregation, HyperLogLog uniques, leaderboard ordering, first-increment TTL repair; stream trim, group creation idempotence, two-consumer split, idle claim with delivery count, dead-letter contents, handler failure keeping the entry pending; tagged two-tier invalidation; capability probe; k-NN when RediSearch is present. Keys carry a per-run token and are SCAN+UNLINKed in `afterAll` (verified: zero keys left on the instance).
  5. Fixed a repository hazard: the developer-global `core.excludesFile` pattern `lock*` silently ignored `src/locks.ts` and `tests/locks.test.ts`, so the whole distributed-lock module was uncommittable and invisible to diff-based linting. `.gitignore` now negates both paths.
  6. Consumers migrated to the new inputs: `packages/supabase/src/auth.ts` (`readSession`/`writeSession`/`touchSession` replace raw `cacheGet`/`cacheSet`), `apps/portal/server/proxy.ts`, `apps/portal/lib/shift-closeout.ts`, telemetry ingest and SSE routes, `app/api/sync/fallback/route.ts`, `lib/api/rate-limit-middleware.ts`.
  7. Documented the contract: `.agents/rules/redis-capabilities.md` (canonical, symlinked into the workspace-root mirror), `AGENTS.md`, and this package's `codemap.md` (module table, invariants 7–9, coordination flow, integration-test recipe).
- **Verification**: `@repo/redis` unit 13/13 suites and 144/144 tests; integration 27/27 against `redis:7.4-alpine` (vector cases no-op without the module, by design); `pnpm --filter portal test:integration` 5/5; `pnpm --filter @repo/redis lint` clean; agent-lint clean for these files including the newly tracked `locks.ts`; `audit-agent-rules-drift` PASS; `@repo/redis`, `@repo/supabase` and portal `type-check` clean.
