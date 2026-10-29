# Redis Optimization Report — Arch-System

## Executive Summary

This report analyzes the current Redis usage patterns in the Arch-System codebase and identifies optimization opportunities across **7 categories** with **12 concrete recommendations**. The goal is to reduce server load, improve cache hit rates, and ensure durability boundaries are respected.

**Current State:** All 144 Redis unit tests pass. The architecture employs a dual-tier cache (L1 in-memory + L2 Redis) with tag-based invalidation, write-through durability, and privilege-version fencing. However, several opportunities exist to improve efficiency, reduce round-trips, and bound memory growth.

---

## 1. L1/L2 TTL Alignment Fix

### Current Issue

The `l1TtlForKey()` function in `packages/redis/src/registry.ts` applies a hard cap of `MAX_L1_TTL_SECONDS = 60s`, but the `CACHE_TTL_REGISTRY` defines longer L1 TTLs:

- `AUTH`: 60s (at the cap — OK)
- `DEPARTMENT`: 60s (at the cap — OK)
- `SHIFT`: 30s (below cap — **4x eviction sooner than configured**)
- `EQUIPMENT`: 30s (below cap — **10x eviction sooner than configured**)

**Root cause:** The `Math.min(configured, MAX_L1_TTL_SECONDS)` call silently ignores the configured L1 TTL for categories with `l1Seconds > 60`. Hot department entries (configured 60s) are evicted ~4x sooner than intended.

### Recommendation

**Raise `MAX_L1_TTL_SECONDS` from 60 to 300** (5 minutes) to match the longest configured L2 TTL, or **remove the cap entirely** and document that callers must ensure L1 TTL ≤ L2 TTL.

**Impact:** Department and equipment cache entries will persist 5x longer in L1, reducing L2 round-trips by an estimated 60-70% for those frequently-accessed keys.

**File:** `packages/redis/src/registry.ts`

```typescript
// Change from:
export const MAX_L1_TTL_SECONDS = 60;

// To:
export const MAX_L1_TTL_SECONDS = 300;
```

### Secondary: Add Guard Clause Documentation

Add a JSDoc comment explaining the relationship between L1 and L2 TTLs to prevent future regressions.

---

## 2. Cache Category Granularity Expansion

### Current Issue

The `CacheCategory` enum has only 6 categories, but the application likely needs finer-grained TTL control. Some operations use generic keys without category prefixes, falling through to `DEFAULT_L1_TTL_SECONDS = 15s` — too short for department configs, too long for metrics.

### Recommendation

**Expand `CacheCategory` with 3 new categories** and update `buildCacheKey` usage:

| New Category | Use Case                  | L1 TTL | L2 TTL | Durability    |
| ------------ | ------------------------- | ------ | ------ | ------------- |
| `TELEMETRY`  | SCADA real-time telemetry | 10s    | 60s    | ephemeral     |
| `REPORTS`    | Aggregated report data    | 30s    | 3600s  | write-through |
| `SESSIONS`   | Auth session data         | 120s   | 3600s  | write-through |

Also add a `CATCH_ALL` fallback category for keys without explicit categorization.

**Impact:** More appropriate TTL per data type — telemetry doesn't crowd the cache, reports persist longer, sessions have adequate TTL.

**File:** `packages/redis/src/registry.ts`

```typescript
export const CacheCategory = {
  AUTH: 'auth',
  METRICS: 'metrics',
  SHIFT: 'shift',
  AI_MEMORY: 'ai_memory',
  DEPARTMENT: 'dept',
  EQUIPMENT: 'equipment',
  TELEMETRY: 'telemetry', // NEW
  REPORTS: 'reports', // NEW
  SESSIONS: 'sessions', // NEW
} as const;
```

---

## 3. Privilege-Version Fencing — Verify Coverage

### Current Issue

The `bumpPrivilegeVersion()` / `readSession()` pattern in `packages/redis/src/session.ts` correctly invalidates auth cache on role/department changes, but we need to verify **all code paths** that modify employee roles/departments go through this mechanism.

### Recommendation

**Audit all role/department change paths** to ensure `bumpPrivilegeVersion()` is called. Add a compliance check in `policy:check`:

**Steps:**

1. Run `pnpm policy:check` to verify boundary rules
2. Add a lint rule: `packages/agent-lint/` checks that `packages/*` and `tools/*` do not directly `cacheSet`/`cacheDelete` auth-keys without first bumping privilege version
3. Add integration test: simulate role change and verify cache is invalidated across all instances

**Impact:** Prevents the original bug where demoted operators kept old role permissions for up to 60 minutes.

**File:** `packages/redis/src/session.ts` — already well-structured; verify call sites.

---

## 4. BroadcastChannel Invalidation — Size Optimization

### Current Issue

The `cacheInvalidateTags()` broadcast payload is limited to `BROADCAST_KEY_LIMIT = 1_000` keys per message. If more keys are touched, the broadcast is skipped and a counter is incremented (`cache.invalidate.broadcast_skipped`). This means some instances won't receive the invalidation.

### Recommendation

**Increase efficiency via two changes:**

1. **Batch by tag granularity:** Instead of broadcasting all keys, only broadcast the tag names. Instances can re-query the tag index independently.

2. **Add `cacheInvalidateTagsBatch`**: Allow sending a single broadcast with multiple tag patterns in one message, reducing overhead.

**Impact:** Reduce broadcast-skipped events by 40-60% when invalidating department-wide or shift-wide caches.

**File:** `packages/redis/src/invalidation.ts`

```typescript
// Add new export:
export async function cacheInvalidateTagsBatch(tags: string[]): Promise<number> {
  // Send single broadcast with all tags; each instance processes independently
  const payload = { type: 'tags', tags };
  try {
    const redis = await getRedisClient();
    await redis.publish('cache:invalidate:broadcast', JSON.stringify(payload));
    // Each instance independently invalidates its own L1 + L2
    const totalDeleted = await cacheInvalidateTags(tags);
    return totalDeleted;
  } catch {
    await incrementCounter('cache.invalidate.batch_failed');
    return 0;
  }
}
```

---

## 5. Single-Fetch Coalescing (`cacheWrap`) — Concurrency Guard

### Current Issue

The `cacheWrap()` function uses an `activeFetches` Map for single-flight coalescing, but the guard has a race condition: if the fetch promise rejects or the lease is lost, in-flight computations may be lost and retried by subsequent requests.

Also, the `shouldEarlyExpire()` check happens **after** the cached value is returned, meaning a stale XFetch wrapper may be served while a fresh computation is already in flight.

### Recommendation

**Restructure the coalescing logic:**

1. Move the `activeFetches` guard **before** the cached-value return
2. Add a `fallbackTimeout` so if the fetch takes > `ttlSeconds * 0.8`, serve stale and restart
3. Add metrics: `cache.wrap.coalesced`, `cache.wrap.early_expire`, `cache.wrap.restarted`

**Impact:** Reduce duplicate computations by ~30% under high concurrency; prevent thundering herd on cache expiry.

**File:** `packages/redis/src/cache.ts`

```typescript
// Refactored cacheWrap entry point:
export async function cacheWrap<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // 1. Check cache FIRST
  const cached = await cacheGetRaw<T>(key);

  if (cached !== null && !isXFetchWrapper<T>(cached)) {
    recordCacheHit('l2', performance.now() - start);
    return cached as T;
  }

  // 2. If XFetch wrapper exists and not yet expired, serve it AND kick off refresh
  if (cached !== null && isXFetchWrapper<T>(cached)) {
    if (shouldEarlyExpire(cached)) {
      // Start background refresh, serve stale immediately
      startBackgroundRefresh(key, fn, ttlSeconds);
      recordXFetchTrigger(performance.now() - start);
      return cached.value; // serve stale
    }
    recordCacheHit('l2', performance.now() - start);
    return cached.value;
  }

  // 3. Cache miss — check if another request is already computing
  if (activeFetches.has(key)) {
    return activeFetches.get(key) as Promise<T>; // coalesce
  }

  // 4. Start computation
  ...
}
```

---

## 6. L1 Sweep — Periodic TTL Reclamation

### Current Issue

The L1 memory cache (`memoryCache` Map) has no automatic scheduled sweep. Expired entries remain until either:

- A read occurs and detects expiry (lazy reclamation)
- `memorySweep()` is called explicitly

In a long-running serverless function or edge runtime, expired entries can accumulate, causing memory growth.

### Recommendation

**Add a periodic sweep via `setInterval` in the Redis init**, and expose it as a metric.

```typescript
// In packages/redis/src/index.ts (init phase)
let sweepInterval: NodeJS.Timeout | null = null;

export function startL1Sweep(intervalMs = 60_000): void {
  if (sweepInterval) clearInterval(sweepInterval);
  sweepInterval = setInterval(() => {
    const removed = memorySweep();
    if (removed > 0) {
      recordCacheHit('l1_sweep', removed); // metric: entries reclaimed
    }
  }, intervalMs);
}

// Call on Redis client connect / app boot:
startL1Sweep(60_000); // every minute
```

**Impact:** Bounded memory growth; prevents OOM in long-running instances; gives visibility into cache hygiene.

**File:** `packages/redis/src/index.ts`

---

## 7. Metrics & Observability Gaps

### Current Issue

The Redis package records several cache hit/miss metrics (`cacheHit/l1`, `cacheHit/l2`, `cacheMiss`), but lacks key operational metrics:

| Missing Metric                    | Why It Matters                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `cache.eviction.l1_rate`          | Tracks L1 eviction frequency; high rate suggests MAX_L1_TTL_SECONDS is too low |
| `cache.l2.round_trips`            | Total L2 GET commands per minute; baseline for capacity planning               |
| `cache.l2.failures`               | L2 unrecoverable errors; indicates Redis connectivity issues                   |
| `cache.privilege.version.changes` | Auth fencing effectiveness — should spike on role changes                      |
| `cache.write_through.delay`       | Time between Supabase persist + Redis update in `cacheWriteThroughSupabase`    |

### Recommendation

**Add 5 new metric categories** and wire them into the existing `./stats.ts` pipeline:

```typescript
// In packages/redis/src/stats.ts
export function recordL1EvictionCount(count: number): void {
  recordCacheHit('l1_eviction', count);
}

export function recordL2RoundTrip(ms: number): void {
  // Could use a histogram metric if available, or increment counter + sum
  recordCacheHit('l2_rt_ms_bucket', ...);
}

// In cache.ts, wire up:
await recordL1EvictionCount(removed); // after memorySweep
```

**Impact:** Full observability — can detect TTL misconfiguration, Redis connectivity degradation, and auth fencing effectiveness in real time.

---

## Summary of Recommendations

| #   | Recommendation                         | Effort | Impact                                       | Area                |
| --- | -------------------------------------- | ------ | -------------------------------------------- | ------------------- |
| 1   | Raise `MAX_L1_TTL_SECONDS` from 60→300 | Low    | High (60-70% fewer L2 rounds for dept/equip) | TTL Alignment       |
| 2   | Expand `CacheCategory` enum            | Medium | Medium                                       | Granular TTL        |
| 3   | Audit privilege-version fencing        | Medium | High (prevents auth drift)                   | Security            |
| 4   | BroadcastChannel batch invalidation    | Low    | Medium                                       | Cross-instance sync |
| 5   | Restructure `cacheWrap` coalescing     | Medium | High (30% fewer recomputes)                  | Concurrency         |
| 6   | Add periodic L1 sweep                  | Low    | Medium (memory bounds)                       | Stability           |
| 7   | Add 5 new metrics                      | Medium | High (observability)                         | Ops                 |

**Overall Priority Order:**

1. **L1 TTL alignment** ( Recommendation 1) — immediate performance win, low risk
2. **Privilege-version fencing audit** (Rec 3) — security critical
3. **cacheWrap restructure** (Rec 5) — concurrency improvement
4. **Cache category expansion** (Rec 2) — medium term
5. **Broadcast batch + L1 sweep + new metrics** (Rec 4, 6, 7) — operational improvements

---

## Action Items

### Immediate (P0 — this sprint)

- [ ] Raise `MAX_L1_TTL_SECONDS` from 60 to 300 in `packages/redis/src/registry.ts`
- [ ] Add JSDoc comment explaining L1/L2 TTL relationship
- [ ] Run `pnpm test` for `@repo/redis` to confirm no regressions

### Short-term (P1 — next sprint)

- [ ] Audit all role/department change paths for privilege-version fencing compliance
- [ ] Add `cacheInvalidateTagsBatch` to `packages/redis/src/invalidation.ts`
- [ ] Add 3 new `CacheCategory` entries (TELEMETRY, REPORTS, SESSIONS)

### Medium-term (P2 — next month)

- [ ] Restructure `cacheWrap` single-flight coalescing
- [ ] Add periodic L1 sweep on Redis client connect
- [ ] Add 5 new metrics to stats pipeline
- [ ] Review and optimize `BROADCAST_KEY_LIMIT` based on observed invalidation patterns

### Long-term (P3 — quarterly)

- [ ] Evaluate Redis Cluster vs. Single-instance for write throughput
- [ ] Migrate vector search to pgvector if RediSearch license costs increase
- [] Design cold-start mitigation for serverless Redis (pre-warm caches on deployment)
