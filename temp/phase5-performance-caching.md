# Phase 5: Performance & Caching Audit

**Date:** 2026-09-21  
**Scope:** `packages/redis/`, `packages/rate-limiter/`, `apps/portal/lib/api/`, `infra/redis/`, `packages/supabase/src/`  
**Auditor:** Performance Engineer Specialist

---

## 1. Redis Cluster Health

### 1.1 Cluster Configuration (`infra/redis/config/shard-map.json`)

The cluster defines 3 namespaces:

- **default** (consistent-hashing): 3 nodes — `redis-node-1:6379`, `redis-node-2:6379`, `redis-node-3:6379`
- **turbo** (hash-slot): 3 nodes — same nodes
- **telemetry** (single): 1 node — only `redis-node-1:6379`

**Finding: No read replicas for telemetry namespace.** The telemetry namespace is a single point of failure with no HA. If `redis-node-1` fails, all telemetry data is inaccessible.

**Finding: Shard-map defines strategies but `client.ts` ignores them entirely.** The `getRedisClient()` function creates a single client connected to `REDIS_URL` (defaulting to `redis://localhost:6379`). There is no Redis Cluster client mode, no slot-aware routing, and no namespace-based connection multiplexing. The shard-map configuration is purely declarative with no runtime enforcement.

### 1.2 Client Configuration (`packages/redis/src/client.ts`)

| Aspect                | Status                                         | Risk     |
| --------------------- | ---------------------------------------------- | -------- |
| Singleton client      | ✅ Implemented                                 | Low      |
| Connection pooling    | ❌ Not implemented                             | **High** |
| Cluster-aware routing | ❌ Not implemented                             | **High** |
| Read replica support  | ❌ Not implemented                             | Medium   |
| Reconnect strategy    | ✅ Exponential backoff (max 500ms, 3 retries)  | Low      |
| Pub/Sub subscriber    | ✅ `createRedisSubscriber()` via `duplicate()` | Low      |

**Critical Finding: `client.ts` does not use `createCluster` from `redis` package.** Despite the shard-map defining a 3-node cluster, the client connects to a single URL. This means:

- No automatic slot routing
- No failover handling at the client level
- All traffic routes through a single node unless `REDIS_URL` is manually set to a proxy

**Finding: `cluster-init` uses `--cluster-replicas 0`.** The docker-compose cluster has no replicas. Combined with the Terraform `aws_elasticache_replication_group` having `num_node_groups: 3` with `replicas_per_node_group: 1`, there's a mismatch between local dev and production configs.

**Recommendation:** Implement `createCluster` with `redis.createCluster()` and route `telemetry` namespace traffic to a dedicated client. Add read replica support for read-heavy workloads.

---

## 2. Cache Invalidation Effectiveness

### 2.1 Tag-Based Invalidation (`packages/redis/src/invalidation.ts`)

**Strengths:**

- Uses `SSCAN` instead of `SMEMBERS` — avoids blocking on large tag sets
- Uses `UNLINK` (non-blocking delete) instead of `DEL` — avoids stop-the-world pauses
- Batch processing of 100 keys at a time via pipelining
- Tag index uses Redis Sets under `arch:__tags__:<tag>`

**Weaknesses:**

1. **No TTL on tag sets.** The tag index sets grow indefinitely as keys expire from Redis but remain in the tag set. Over time, `SSCAN` on these sets will scan increasingly stale entries.
2. **Silent failure on errors.** Both `indexCacheKeyByTags` and `cacheInvalidateTags` swallow errors. This means tag index inconsistency is possible without any alerting.
3. **No atomicity guarantee.** The `cacheInvalidateTags` function iterates tags sequentially. If the process crashes mid-way, some tags are invalidated and others are not, leaving partial stale data.
4. **No stampede protection in invalidation itself.** When a tag is invalidated, all associated keys are deleted simultaneously. If many concurrent requests trigger invalidation of the same tag, they all hit the database simultaneously (thundering herd). The `cacheWrap` function has request coalescing, but it only works for cache misses, not for explicit invalidation events.

**Stampede Risk Assessment:**

- `cacheWrap` uses `activeFetches` Map to coalesce concurrent requests for the same key
- The `shouldEarlyExpire` function with `beta` parameter provides probabilistic early expiration to spread load
- **BUT:** `cacheInvalidateTags` bypasses `activeFetches` entirely. Explicit tag invalidation causes immediate cache misses, and the next N concurrent requests will all miss and hit the database.
- **Recommendation:** Add a "stale-while-revalidate" mechanism or a short grace period after invalidation where stale data is served while recomputing.

### 2.2 L1/L2 Cache Architecture (`packages/redis/src/cache.ts`)

**L1 (In-Memory):**

- `Map<string, MemoryEntry>` with 1000-entry cap
- **Finding: Not a true LRU.** The eviction policy deletes the first insertion (Map iteration order), which is insertion order, not access order. This means frequently-accessed items can be evicted if they were inserted early.
- L1 TTL capped at `min(ttlSeconds, 30)` regardless of `CACHE_TTL_REGISTRY` settings. For `AUTH` category (l1Seconds: 60), the L1 TTL is forcibly capped to 30s, which is a deviation from the registry.

**L2 (Redis):**

- Write-through strategy (both L1 and L2 updated on `cacheSet`)
- L2 populated from cache read on miss (read-through)
- L1 populated from L2 on cache hit with 15s TTL

**Finding: L1 TTL mismatch.** `CACHE_TTL_REGISTRY` defines `AUTH` with `l1Seconds: 60`, but `cacheSet` caps L1 at 30s. This means AUTH data stays in L1 for only 30s instead of the intended 60s, increasing Redis load.

**Finding: `cacheDeletePattern` is deprecated but still exported.** It uses a naive prefix-based approach for memory cache deletion (`memoryDeleteByPrefix`) which iterates all keys. For large L1 caches, this is O(n).

### 2.3 XFetch Stampede Protection (`packages/redis/src/xfetch.ts`)

The `shouldEarlyExpire` function uses `-beta * delta * Math.log(Math.random()) > ttlRemaining` — an exponential decay formula that probabilistically triggers early recomputation. This is a solid approach to prevent stampede.

**Finding: The `activeFetches` Map in `cacheWrap` is never cleaned up on error.** If `fn()` throws, `.finally()` removes the key, so this is handled correctly. However, the Map grows unbounded under high concurrency with many unique cache keys.

---

## 3. Rate Limiter Bypass Vectors

### 3.1 Strategy Analysis

| Strategy      | Concurrency Safety              | Bypass Vector                     | Severity   |
| ------------- | ------------------------------- | --------------------------------- | ---------- |
| FixedWindow   | ❌ Race at boundary             | Double-count at window edge       | **High**   |
| SlidingWindow | ❌ Read-modify-write            | Lost updates under concurrency    | **High**   |
| TokenBucket   | ✅ Lua atomic (when eval works) | Falls back to RMW on eval failure | **Medium** |

**FixedWindowStrategy (`fixed-window.ts`):**

- **Critical Race Condition:** At the window boundary (`windowStart` changes), two concurrent requests can both see `data.count < limit` and increment. The `count++` and `store.set` are not atomic. Under load, this can allow 2x the limit at boundaries.
- **No Redis atomic operations.** The strategy relies on `store.get` then `store.set` which is read-modify-write.

**SlidingWindowStrategy (`sliding-window.ts`):**

- **Critical Race Condition:** `timestamps.filter` then `timestamps.push` then `store.set` is not atomic. Two concurrent requests can both pass the `timestamps.length >= limit` check before either writes, allowing both through.
- **Memory growth:** The timestamps array grows with each request in the window. Under a 1000 req/s rate limit with a 60s window, this stores 60,000 numbers per key.

**TokenBucketStrategy (`token-bucket.ts`):**

- **Strengths:** Uses Lua script for atomic execution when `store.eval` is available. This is the only strategy with true atomicity.
- **Weakness:** Falls back to JavaScript read-modify-write when `store.eval` fails. The `RedisStore.eval` method throws if the client doesn't support eval, but the fallback is silent — it just proceeds with non-atomic RMW.
- **Lua script bug:** The `tonumberOr` function is defined but never used in the Lua script result parsing. The `reset_time` field is accessed as `res.reset_time` but the Lua returns `result` table with `reset_time` as a number. The `JSON.parse` should work, but `tonumberOr` is defined but unused.

### 3.2 Store Analysis

**MemoryStore (`memory.store.ts`):**

- No persistence, no eviction beyond TTL-based lazy cleanup
- **Finding: No maximum memory limit.** The Map grows unbounded. Under sustained load with many unique rate limit keys, memory will grow indefinitely.
- **Finding: No distributed coordination.** If multiple instances use MemoryStore, each has its own counter. This completely bypasses rate limiting in a multi-instance deployment.

**RedisStore (`redis.store.ts`):**

- Uses `SimpleRedisClient` interface, not the actual `@redis/client` types
- **Finding: `eval` method is typed as `typeof this.client.eval` but the `redis` package's `createClient` doesn't expose `eval` as a method by default.** The `eval` function would need to be called via `client.sendCommand(['EVAL', ...])`. This means the TokenBucket Lua script likely always falls back to RMW.
- **Finding: No connection retry or circuit breaker.** If Redis is unavailable, rate limiting completely fails open (all requests allowed).

### 3.3 Rate Limiter Bypass Summary

1. **Multi-instance bypass:** MemoryStore in multi-instance deployments means rate limits are per-instance, not global.
2. **Fixed/Sliding window race conditions** allow 2x+ the configured limit under concurrency.
3. **TokenBucket eval fallback** is broken because `RedisStore.eval` throws, causing silent degradation to non-atomic RMW.
4. **No rate limit for authenticated vs unauthenticated** — the same limits apply to all, which may be too restrictive for admin endpoints.

---

## 4. pg_cron Schedule Gaps

### 4.1 Current Schedule (`migrations/023_pg_cron_schedules.sql`)

| Job                                | Schedule             | View                       | Notes             |
| ---------------------------------- | -------------------- | -------------------------- | ----------------- |
| refresh-dept-production-summary    | `*/15 * * * *`       | dept_production_summary    | Every 15 min      |
| refresh-machine-utilization-weekly | `5 * * * *`          | machine_utilization_weekly | Every hour at :05 |
| refresh-safety-incident-monthly    | `10 0,6,12,18 * * *` | safety_incident_monthly    | Every 6 hours     |
| create-next-month-partitions       | `1 0 1 * *`          | Auto-partition             | Monthly           |
| archive-old-partitions             | `0 2 15 * *`         | Archive                    | Monthly           |

### 4.2 Gaps and Issues

**Finding: No overlapping schedule protection for 15-min refresh.** The `refresh-dept-prod_summary_smart()` function checks for concurrent refreshes within 10 minutes. But if the refresh takes >15 minutes (unlikely but possible with large datasets), the next cron tick will skip it. This means data could be stale for up to 15+ minutes.

**Finding: `cleanup-mv-refresh-logs` and `cleanup-vector-search-cache` and `cleanup-vector-search-performance` schedules are only in migration 065.** Migration 023 doesn't schedule them. If 065 runs after 023, these cleanup jobs are added. But if the migrations run in a different order, some cleanups may be missing.

**Finding: No monitoring of pg_cron job failures.** There's no alert for when a pg_cron job fails or produces an error. The smart refresh functions log failures to `materialized_view_refresh_log` but there's no pg_cron notification hook.

**Finding: `create-next-month-partitions` runs on the 1st at 00:01, but `archive-old-partitions` runs on the 15th at 02:00.** If data arrives faster than expected, partitions could fill before archiving runs, causing table bloat.

---

## 5. Materialized View Gaps

### 5.1 View Design (`migrations/022_materialized_views.sql`)

**Strengths:**

- All views use `SECURITY DEFINER` wrapper functions for RLS enforcement
- Unique indexes on each MV for `REFRESH CONCURRENTLY`
- `GRANT SELECT` to authenticated role

**Weaknesses:**

1. **`dept_production_summary` uses `LEFT JOIN` on `daily_logs` with date range filter.** The query planner may not efficiently use the `daily_logs` index because the LEFT JOIN forces a scan. If `daily_logs` is partitioned, this could be slower than expected.

2. **No index on `production_logs.daily_log_id` in the original migration 022.** This join column should be indexed for the MV refresh to be efficient. (Migration 089 adds this, but 022 doesn't include it.)

3. **`machine_utilization_weekly` uses `JOIN departments d` but `LEFT JOIN machine_hours mh`.** The LEFT JOIN with subsequent COUNT(DISTINCT dl.id) creates a cartesian product risk. If a machine has multiple machine_hours entries per daily_log, the counts will be inflated.

4. **No auto-refresh trigger.** MV refresh is entirely cron-dependent. If a user creates a new department and queries `dept_production_summary` immediately after, they see stale data until the next cron tick.

### 5.2 Smart Refresh (`migrations/065_materialized_view_refresh_optimization.sql`)

**Strengths:**

- Concurrent refresh detection with 10-minute window
- Fallback to non-concurrent refresh on failure
- Comprehensive monitoring via `materialized_view_refresh_log`
- Health check functions (`check_mv_freshness`, `get_mv_refresh_stats`)
- 30-day log cleanup

**Weaknesses:**

1. **`materialized_view_refresh_log` is not partitioned.** With high-frequency refresh monitoring, this table could grow large. No archiving strategy exists for it.
2. **The concurrent refresh check (`status = 'started' AND refresh_start > NOW() - INTERVAL '10 minutes'`) has a race condition.** If the refresh function crashes after logging 'started' but before completing, the status remains 'started' and subsequent refreshes are skipped for 10 minutes. The `log_mv_refresh_end` function should be called in a `BEGIN...EXCEPTION` block to ensure it runs on error, but the current structure relies on the PL/pgSQL exception block inside the main block.
3. **`check_mv_freshness` and `get_mv_refresh_stats` were recreated in migration 066** with fixed column names to avoid ambiguity. Migration 065's original versions had ambiguous column names (`last_refresh` could refer to the table column or the variable). The fix in 066 is correct but the migration order matters.

**Finding: Migration 066 drops and recreates `check_mv_freshness` and `get_mv_refresh_stats` that were created in 065.** This is a bug-fix migration but creates dependency issues. If someone runs 065 and then rolls back, the functions are in an inconsistent state.

---

## 6. Vector Index Issues

### 6.1 HNSW Configuration (`migrations/030_vector_index_optimization.sql`)

**Strengths:**

- HNSW parameters upgraded from m=16/ef_construction=64 to m=24/ef_construction=128 for better recall
- Filtered partial indexes for episodic and semantic memory types
- Embedding dimension validation constraint (1536)
- Conditional pgvectorscale DiskANN index

**Weaknesses:**

1. **`SET hnsw.ef_search = 200` is a function-level SET in migration 030.** This sets `ef_search` at function creation time, not per-query. It does NOT apply to the query execution context. The `SET` in a `LANGUAGE plpgsql` function body sets the parameter for the function's execution, but it may not propagate to the HNSW index access method correctly.

2. **Migration 064 fixes this with `SET LOCAL hnsw.ef_search = adaptive_ef_search`**, which is correct per-query. But migrations 030 and 064 both define `search_memories_hybrid` and `search_memories_semantic` — 064 drops and recreates them, but if someone applies only 030, they get the broken `SET` instead of `SET LOCAL`.

3. **Partial indexes on `memory_type` may not cover all queries.** The `search_memories_hybrid` function filters by `p_memory_type` parameter, but if `p_memory_type IS NULL`, the partial index is not used (because `WHERE memory_type = 'episodic'` doesn't match `NULL`).

4. **No GIN index on `vector_search_cache.result_data`** (JSONB). Queries that search within cached results will be sequential scans.

5. **DiskANN index is conditionally created but `num_neighbors = 64` and `search_list_size = 200` may be suboptimal.** For production with millions of vectors, these parameters need tuning based on recall requirements.

### 6.2 Vector Search Cache (`migrations/064_vector_search_query_optimization.sql`)

**Strengths:**

- Cache table with SHA-256 keys, TTL, and access tracking
- RLS policies for user isolation
- Adaptive ef_search based on query complexity
- Performance monitoring table
- Cleanup cron jobs

**Weaknesses:**

1. **`vector_search_cache` RLS policy `vector_search_cache_select_own` uses `auth.uid()`.** In a server component context, `auth.uid()` may return null if the user is not authenticated. This means the cache is not queryable by server-side processes.
2. **Cache cleanup policy removes entries with `access_count < 2 AND created_at < NOW() - INTERVAL '7 days'`.** This is reasonable but could remove useful cache entries if a query is only used once per week.
3. **No cache invalidation on memory_embedding updates.** If a memory is updated, the vector search cache for that user remains stale. There's no trigger or function to invalidate vector search cache when underlying data changes.
4. **`generate_vector_search_cache_key` does not include `ef_search` or `match_count` in the hash.** Wait — it does include `p_match_count` and `p_similarity_threshold` but NOT `ef_search`. So different `ef_search` values for the same query would produce the same cache key, returning incorrect results.

**Finding: `generate_vector_search_cache_key` omits `ef_search` from the cache key hash.** This means a query with `ef_search=150` and `ef_search=300` would return the same cached result, which has different recall characteristics. This is a correctness bug.

---

## 7. Query Performance Bottlenecks

### 7.1 Partition Pruning (`migrations/063_partition_pruning_optimization.sql`)

**Strengths:**

- Check constraints on partitions enabling constraint exclusion
- Auto-partition creation function with constraints
- Archive function for old partitions

**Weaknesses:**

1. **`add_partition_check_constraints()` uses dynamic SQL with `EXECUTE format(...)` for every partition.** If there are many partitions (e.g., 24 hourly partitions), this function runs 48 DDL statements sequentially. Each `ALTER TABLE ... ADD CONSTRAINT` locks the partition briefly, but the cumulative effect can be slow.
2. **The `archive_old_partitions` function detaches and moves partitions.** This is a blocking operation. If a query is running against the partition being archived, it will be terminated.
3. **No index on `archive` schema tables.** Archived partitions retain their indexes but there's no maintenance strategy for them.

### 7.2 Foreign Key Indexes (`migrations/089_add_unindexed_foreign_key_indexes.sql`)

**Strengths:**

- Covers all identified unindexed foreign keys from Supabase linter
- Includes `breakdowns`, `employees`, `excavator_activity`, `fuel_logs`, `generated_reports`, `machine_hours`, `machine_operations`, `production_logs`, `safety_incidents`, `user_feedback`

**Weaknesses:**

1. **Comment says `095_add_unindexed_foreign_key_indexes.sql` but the file is named `089`.** This suggests the file was renamed without updating the internal comment, which could cause confusion in migration ordering.
2. **No composite indexes.** For queries that filter on multiple FK columns, single-column indexes are insufficient.
3. **No index on `production_logs.daily_log_id` included in migration 022's view definition.** The MV query joins on `pl.daily_log_id = dl.id` but this index was only added in migration 089. The MV refresh in production would have been slow before migration 089.
4. **Missing index on `daily_logs.department_id`** — this is referenced in `dept_production_summary` MV via `dl.department_id = d.id` but no index exists.

---

## 8. Cache & Stats Deep Review

### 8.1 Registry (`packages/redis/src/registry.ts`)

**Finding: `CACHE_TTL_REGISTRY` has inconsistent L1/L2 ratios.** For `AUTH`, L1 is 60s and L2 is 3600s. For `METRICS`, L1 is 15s and L2 is 300s. The L1/L2 ratio varies from 1:60 (AUTH) to 1:10 (METRICS). This inconsistency means some data has very aggressive L1 caching while others don't benefit much.

**Finding: `DEPARTMENT` has L2 of 43200s (12 hours).** This is very long for a cache that could change frequently. Combined with the L1 cap of 30s, there's a 12-hour gap where stale department data could be served from L2.

### 8.2 Stats (`packages/redis/src/stats.ts`)

**Strengths:**

- Local in-memory stats with Redis sync (fire-and-forget)
- Latency tracking with circular buffer (1000 entries)
- P95 calculation
- Snapshot export via `getCacheStats()`

**Weaknesses:**

1. **`recordCacheHit` calls `getRedisClient()` which returns the singleton client.** But it does `hIncrBy("stats:cache", ...)` and `lPush("stats:latencies", ...)` on every single cache hit. Under high throughput, this creates a massive write load on Redis for stats that are already tracked locally.
2. **Latency tracking uses a synchronous `Array.push` and `Array.shift`.** For 1000 entries this is fine, but `getCacheStats()` sorts the entire array. Under concurrent access, this could cause micro-stalls.
3. **No stats for cache stampede or thundering herd events.** The `xFetchTriggers` counter tracks early expiration triggers, but there's no metric for how many requests were served stale data during revalidation.
4. **`resetCacheStats()` also calls `getRedisClient()` which may fail silently.** If Redis is down during reset, the Redis stats persist while local stats are cleared, causing inconsistency.

### 8.3 Cache Read Path (`cacheGet`)

**Finding: L1 check is synchronous but L2 check is async.** This means every `cacheGet` call involves an async function call even for L1 hits. The overhead of `async/await` for L1-only hits adds ~0.01ms per call, which is negligible but adds up at scale.

**Finding: `cacheGet` parses JSON from Redis on every hit.** `JSON.parse(value)` is called for every L2 cache hit. For large cached values, this could be a CPU bottleneck. Consider using a binary format or compression.

---

## 9. Read Replica Performance (`packages/supabase/src/read-replica.ts`)

**Strengths:**

- Falls back to primary URL gracefully
- Uses `instrumentedFetch` for query monitoring
- Cookie handling for SSR context

**Weaknesses:**

1. **No connection pooling.** Each call to `createReadReplicaClient` creates a new `createServerClient` instance. Under load, this creates many connections to the read replica, potentially exhausting the connection pool.
2. **No query result caching.** Even with a read replica, repeated identical queries hit the database every time. The read replica should be paired with the Redis cache layer for query-level caching.
3. **`SUPABASE_READ_REPLICA_URL` is not defined in the shard-map or any config.** The read replica URL is read from environment variables at runtime with no validation. If the URL is misconfigured, it silently falls back to the primary.
4. **No read-after-write consistency guarantee.** After a mutation on the primary, a read replica query may return stale data. There's no mechanism to wait for replication lag.
5. **`instrumentedFetch` logs queries >500ms as warnings.** The read replica may have higher latency than the primary, causing more warnings. There's no separate latency threshold for replica queries.

---

## 10. Observability & Alerting Gaps

### 10.1 Prometheus Rules (`infra/observability/prometheus-rules/cache-alerts.yaml`)

**Current Alerts:**

- `CacheMissRateTooHigh`: >40% miss rate for 2 minutes
- `RedisShardDown`: Any Redis node down for 1 minute

**Missing Alerts:**

| Missing Alert                      | Why It Matters                                                   | Severity |
| ---------------------------------- | ---------------------------------------------------------------- | -------- |
| L1 Cache Hit Ratio < 80%           | L1 is the fastest layer, low hit ratio means Redis is overloaded | Warning  |
| Cache Latency P99 > 50ms           | Indicates Redis or L1 is slow                                    | Warning  |
| Rate Limiter Rejection Rate > 10%  | Indicates abuse or misconfigured limits                          | Warning  |
| pg_cron Job Failure                | Materialized views become stale                                  | Critical |
| MV Staleness > 2x refresh interval | Data is significantly outdated                                   | Warning  |
| Vector Search Cache Hit Rate < 50% | Cache is ineffective                                             | Info     |
| Redis Memory Usage > 80%           | Eviction may start                                               | Warning  |
| Read Replica Replication Lag > 5s  | Stale reads                                                      | Warning  |
| Rate Limiter Eval Failures > 5%    | TokenBucket falling back to RMW                                  | Warning  |
| Cache Stampede Detected            | Multiple concurrent cache rebuilds                               | Warning  |

**Finding: The `CacheMissRateTooHigh` alert uses `amca_cache_misses_total` and `amca_cache_hits_total`.** But looking at `stats.ts`, the Redis keys are `stats:cache` (hash) with fields `hits`, `misses`, `l1Hits`, `l2Hits`, `xFetchTriggers`, `redisErrors`. The Prometheus metric names `amca_cache_misses_total` and `amca_cache_hits_total` don't match. This means the alert is likely not firing correctly — the metrics aren't being scraped from the right source.

**Finding: No alert for `RedisShardDown` checks individual node health.** The `up{job="redis-cluster"}` metric may not correctly report individual node status if the exporter is configured differently.

### 10.2 Alertmanager Configuration

**Finding: PagerDuty service key is hardcoded as `"YOUR_PAGERDUTY_INTEGRATION_KEY"` in `alertmanager.yml`.** This is a placeholder that was never replaced. Critical alerts won't reach PagerDuty.

**Finding: Slack webhook URL is also a placeholder** (`https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`). Alerts are not being delivered to Slack either.

---

## 11. k6 Stress Test Coverage Gaps

### 11.1 `k6/stress-test.js`

**Current Coverage:**

- Homepage (`/`) and health check (`/api/health`)
- Ramp from 100 to 200 users
- P99 < 1500ms threshold
- Error rate < 1%

**Missing Coverage:**

| Missing Test                             | Why It Matters                                         |
| ---------------------------------------- | ------------------------------------------------------ |
| **Cache hit/miss rate under load**       | Can't validate L1/L2 performance                       |
| **Redis cluster failover**               | No test when a node goes down                          |
| **Rate limiter under concurrent load**   | Can't detect race conditions                           |
| **Tag-based cache invalidation**         | Can't validate stampede protection                     |
| **Materialized view freshness**          | Can't validate refresh timing                          |
| **Vector search performance**            | Can't validate HNSW latency                            |
| **Read replica latency**                 | Can't validate replica query performance               |
| **pg_cron job execution**                | Can't validate schedule reliability                    |
| **Memory cache eviction under pressure** | Can't validate L1 LRU behavior                         |
| **Concurrent cache stampede**            | Can't validate `activeFetches` and `shouldEarlyExpire` |
| **Connection pool exhaustion**           | Can't validate Redis client resilience                 |
| **Multi-instance rate limiting**         | Can't validate MemoryStore bypass                      |

### 11.2 `k6/ci-probe.js`

**Strengths:**

- Cold/warm/saturated pass testing
- Health endpoint latency checks
- Warmup pass tracking

**Weaknesses:**

- Only tests 3 health endpoints
- No authentication or session testing
- No database query testing
- No cache layer testing

---

## Summary of Critical Findings

### 🔴 Critical (Must Fix)

1. **Client doesn't use Redis Cluster mode** — shard-map is purely decorative, all traffic goes to a single node
2. **FixedWindow and SlidingWindow strategies have race conditions** — can exceed rate limits under concurrency
3. **TokenBucket `eval` fallback is broken** — `RedisStore.eval` throws, always degrading to non-atomic RMW
4. **Vector search cache key omits `ef_search`** — correctness bug returning wrong results for different `ef_search` values
5. **Alertmanager has placeholder credentials** — no critical alerts are being delivered
6. **Prometheus cache alert metrics don't match** — `amca_cache_*` metrics don't match `stats:cache` Redis hash

### 🟡 High (Should Fix)

7. **No TTL on tag sets** — tag index grows indefinitely
8. **MemoryStore has no memory limit** — unbounded growth in multi-instance deployments
9. **L1 TTL cap overrides registry config** — AUTH L1 is 30s instead of 60s
10. **No read replica connection pooling** — per-request client creation
11. **Vector search cache not invalidated on data changes** — stale results

### 🟢 Medium (Nice to Fix)

12. **`cacheDeletePattern` is deprecated but still exported**
13. **Migration 030 and 064 both define search functions** — order dependency
14. **No monitoring for pg_cron failures**
15. **No alert for MV staleness**
16. **k6 stress tests have minimal coverage**
17. **`archive_old_partitions` is a blocking operation**
18. **`recordCacheHit` writes to Redis on every hit** — excessive write load
19. **No composite indexes on FK columns**
20. **`daily_logs.department_id` not indexed**

---

_Report generated by Phase 5 Performance & Caching Audit_
_Scope: packages/redis/, packages/rate-limiter/, apps/portal/lib/api/, infra/redis/, packages/supabase/src/_
