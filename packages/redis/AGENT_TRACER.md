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
