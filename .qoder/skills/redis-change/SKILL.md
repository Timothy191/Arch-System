---
name: redis-change
description: Add or change a Redis capability in Arch-System. Use for caching, sessions, streams, locks/idempotency, analytics counters, rate limiting, or vector search; enforces the @repo/redis capability façade, dual-transport parity (TCP vs Upstash REST), key hygiene, and the real-server integration test.
---

# Redis Change

`@repo/redis` is the only package that talks to Redis. Application code calls a named capability; it never issues `GET`/`SET`/`EVAL`/`XADD`/`INCR`/`SET NX` and never assumes a persistent socket — production may run the Upstash HTTP REST transport, which cannot block, subscribe, or load modules.

## 1. Read the contract first

- `.agents/rules/redis-capabilities.md` — capability table, key prefixes, guarantees.
- `packages/redis/src/raw.ts` — `send` (throws `RedisCommandError`) / `sendSafe` (returns `null`) and the reply normalizers.

## 2. Pick the home file

| Need                                 | File                                                |
| ------------------------------------ | --------------------------------------------------- |
| L1/L2 cache, X-Fetch                 | `cache.ts`, `adaptive.ts`, `xfetch.ts`              |
| Dual-tier tag invalidation           | `invalidation.ts`, `registry.ts`                    |
| Sessions / revocation                | `session.ts` (`bumpPrivilegeVersion` is revocation) |
| Streams + consumer groups            | `streams.ts`                                        |
| Locks, idempotency                   | `locks.ts`                                          |
| Counters, samples, HLL, leaderboards | `analytics.ts`                                      |
| Vector search                        | `search.ts` (PostgreSQL `pgvector` fallback)        |
| Rate limiting                        | `packages/rate-limiter`                             |

Do not add a second door: if the need fits an existing capability, extend it rather than exporting the raw client.

## 3. Implement for both transports

- Route every command through `send`/`sendSafe`; normalize replies with the existing helpers (`asNumber`, `asStringOrNull`, `asFieldMap`, `parseStreamReply`, `asScoredMembers`, `asInfoMap`).
- Feature-detect with `detectCapabilities()` (`eval`, `streams`, `hyperLogLog`, `sortedSets`, `search`, `blocking`); never assume Lua or `BLOCK`. Provide a guarded command fallback when `EVAL` is absent and degrade to `null`/`0`/`[]` via `sendSafe` when unavailable.
- Build keys with the module helpers (`buildCacheKey`, `lockKey`, `sessionKey`, `refreshLeaseKey`, `vectorKey`) so prefixes stay fixed; always set a TTL or trim (`maxLen`).
- Callers in `apps/portal` and `libs/*` import the capability from `@repo/redis`; cache mutations go through `updateTag`/`updateTagInAction`/`updateTags` in `apps/portal/lib/server-cache.ts` and must run before `redirect()`.

## 4. Test both paths

- Unit tests live in `packages/redis/tests`; mock `client`/`raw` and assert the Lua path **and** the fallback path.
- `apps/portal/setupTests.ts` mocks `@repo/redis` globally — portal tests must not rely on real Redis.
- Real-server parity is mandatory for new commands:

```bash
REDIS_INTEGRATION=1 pnpm --filter @repo/redis test:integration
```

Integration cleanup uses per-run token `SCAN` + `UNLINK`; never `FLUSHDB`.

## 5. Verify and report

```bash
pnpm --filter @repo/redis type-check
pnpm --filter @repo/redis test
REDIS_INTEGRATION=1 pnpm --filter @repo/redis test:integration
pnpm cycles
```

Report the capability added or changed, its key prefix and TTL, which transports/features it supports, the fallback behaviour, and each gate result. Do not claim parity if the integration suite did not run against a real server.
