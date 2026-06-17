# Caching Strategy

**Last Updated:** 2026-06-15  
**Version:** 1.0  
**Audience:** Developers, DevOps Engineers, System Architects

---

## Overview

This document describes the caching strategy implemented in the Control Room system to improve performance and reduce database load.

## Cache Technology

### Redis

**Purpose:** Primary caching layer for the Control Room system

**Configuration:**

- Connection via `@repo/redis` package
- Automatic reconnection
- Configurable TTL per cache category
- Cluster support for high availability (optional)

**Benefits:**

- Fast in-memory storage
- Sub-millisecond read/write times
- Automatic expiration
- Distributed caching across instances

## Cache Categories

### 1. Shift Data Cache

**Purpose:** Cache shift completeness data to avoid repeated database queries

**Key Pattern:**

```
shift:{department_id}:{date}:{shift_type}
```

**Example:**

```
shift:abc-123:2026-06-15:day
```

**TTL:** 5 minutes (300 seconds)

**Data Stored:**

- Machine coverage status
- Shift completeness indicators
- Machine entries count
- Exempt machine list

**Invalidation:**

- Automatic: TTL expiry
- Manual: When shift data changes
- Triggers: Shift closeout, machine operation log, hourly load update

**Usage:**

```typescript
return withCache(
  async () => getShiftCompleteness(...),
  {
    category: CacheCategory.SHIFT,
    keyParts: [deptId, date, shift],
  }
);
```

### 2. Department Context Cache

**Purpose:** Cache department slug → UUID mappings

**Key Pattern:**

```
dept_context:{department_slug}
```

**Example:**

```
dept_context:control-room
```

**TTL:** 1 hour (3600 seconds)

**Data Stored:**

- Department UUID
- Department name
- Department type
- Active status

**Invalidation:**

- Automatic: TTL expiry
- Manual: When department configuration changes
- Triggers: Department update, name change, type change

**Usage:**

```typescript
const cachedContext = await redis.get(`dept_context:${slug}`);
if (cachedContext) {
  return JSON.parse(cachedContext);
}
```

### 3. Rate Limiting Cache

**Purpose:** Store rate limiting counters for API protection

**Key Pattern:**

```
ratelimit:{category}:{identifier}
```

**Examples:**

```
ratelimit:shift_closeout:user-123
ratelimit:machine_status:machine-456
```

**TTL:** Matches rate limit window duration

- Shift closeout: 60 seconds
- Machine status: 60 seconds (configurable)

**Data Stored:**

- Attempt count
- Window start time
- Lockout timestamp (if applicable)

**Invalidation:**

- Automatic: Window expiry
- Manual: On lockout reset

**Usage:**

```typescript
const key = `ratelimit:shift_closeout:${userId}`;
const attempts = await redis.incr(key);
await redis.expire(key, 60);
```

### 4. PIN Attempt Cache

**Purpose:** Track failed PIN attempts for lockout enforcement

**Key Pattern:**

```
pin_attempts:{employee_code}
```

**Example:**

```
pin_attempts:OP123
```

**TTL:** 15 minutes (900 seconds) after lockout

**Data Stored:**

- Attempt count
- First attempt timestamp
- Lockout timestamp (if locked)

**Invalidation:**

- Automatic: TTL expiry
- Manual: PIN reset by administrator

**Usage:**

```typescript
const key = `pin_attempts:${employeeCode}`;
const attempts = await redis.incr(key);
if (attempts >= 3) {
  await redis.expire(key, 900);
}
```

## Cache Invalidation Strategies

### Time-Based Expiration (TTL)

**Description:** Cache entries expire automatically after configured TTL

**Use Cases:**

- Shift data (5 minutes)
- Department context (1 hour)
- PIN attempts (15 minutes after lockout)

**Pros:**

- Simple to implement
- No manual invalidation needed
- Automatic cleanup

**Cons:**

- May serve stale data if TTL is too long
- Cache misses after expiry cause database load

**Recommendation:** Use for frequently changing data

### Event-Based Invalidation

**Description:** Cache invalidated immediately when data changes

**Use Cases:**

- Department configuration changes
- Machine status updates
- Shift closeout operations

**Implementation:**

```typescript
await redis.del(`dept_context:${slug}`);
await redis.del(`shift:${deptId}:${date}:${shift}`);
```

**Pros:**

- Always serves fresh data
- Minimal stale data windows

**Cons:**

- Requires manual invalidation calls
- More complex implementation

**Recommendation:** Use for critical data that must be fresh

### Cache Warming

**Description:** Pre-populate cache with expected data

**Use Cases:**

- Department context at startup
- Shift data at shift start
- Machine status at system start

**Implementation:**

```typescript
await Promise.all([
  cacheDepartmentContext("control-room"),
  cacheShiftContext(deptId, today, currentShift),
]);
```

**Pros:**

- No cache misses on first access
- Better user experience

**Cons:**

- Increases startup time
- May warm unused cache

**Recommendation:** Use for frequently accessed data at startup

## Cache Hit Ratio Monitoring

### Metrics to Track

- **Cache Hit Rate:** Percentage of requests served from cache
- **Cache Miss Rate:** Percentage of requests requiring database fetch
- **Cache Size:** Number of keys in cache
- **Memory Usage:** Redis memory consumption

### Target Metrics

- **Shift Data:** >80% hit rate
- **Department Context:** >95% hit rate
- **Rate Limiting:** Not applicable (always write)

### Monitoring

```typescript
// Track cache hits
const cacheHits = promClient.Counter("cache_hits_total");
const cacheMisses = promClient.Counter("cache_misses_total");

// Use in cache function
if (cached) {
  cacheHits.inc();
  return cached;
}
cacheMisses.inc();
```

## Cache Optimization

### Key Design

**Best Practices:**

- Use descriptive keys with prefixes
- Include all necessary identifiers
- Keep keys consistent length
- Avoid overly long keys

**Examples:**

```
Good: shift:dept-123:2026-06-15:day
Bad: shift_data_for_department_123_on_2026_06_15_day_shift
```

### TTL Selection

**Guidelines:**

- Short TTL (1-5 min): Frequently changing data (shift status, machine status)
- Medium TTL (15-30 min): Semi-frequent data (alerts, metrics)
- Long TTL (1-24 hours): Static data (department config, machine registry)

**Trade-offs:**

- Short TTL: More database load, fresher data
- Long TTL: Less database load, risk of stale data

### Memory Management

**Redis Memory Limits:**

- Set `maxmemory` in redis.conf
- Configure eviction policy (allkeys-lru recommended)
- Monitor memory usage regularly

**Eviction Policies:**

- `allkeys-lru`: Evict least recently used keys
- `volatile-lru`: Evict expired keys only
- `allkeys-random`: Evict random keys

### Compression

**For Large Values:**

- Compress JSON data before caching
- Use Redis compression features
- Balance compression CPU vs memory savings

**Implementation:**

```typescript
import { gzip, ungzip } from "node:zlib";

const compressed = await gzip(JSON.stringify(data));
await redis.set(key, compressed);
```

## Redis Configuration

### Production Settings

```redis.conf
# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Networking
timeout 300
tcp-keepalive 60
```

### Development Settings

```redis.conf
# Development: disable persistence for faster iteration
save ""

# Memory
maxmemory 64mb
maxmemory-policy allkeys-lru
```

## Cache Patterns

### Cache-Aside Pattern

**Description:** Application manages cache, database is source of truth

**Flow:**

1. Check cache
2. If hit, return data
3. If miss, fetch from database
4. Store in cache
5. Return data

**Implementation:**

```typescript
const cached = await redis.get(key);
if (cached) {
  return JSON.parse(cached);
}
const data = await fetchData();
await redis.set(key, JSON.stringify(data), "EX", ttl);
return data;
```

### Write-Through Pattern

**Description:** Write to cache and database simultaneously

**Flow:**

1. Write to cache
2. Write to database
3. Return data

**Implementation:**

```typescript
await redis.set(key, data, "EX", ttl);
await database.write(data);
```

### Write-Behind Pattern

**Description:** Write to cache immediately, database asynchronously

**Flow:**

1. Write to cache
2. Queue database write
3. Process database write asynchronously

**Not Currently Used:** Simpler patterns sufficient for current needs

## Troubleshooting Cache Issues

### Cache Stale Data

**Symptoms:** UI shows outdated information

**Resolution:**

1. Verify TTL configuration
2. Check if cache invalidation is triggered
3. Manually invalidate cache: `redis.del key`
4. Verify data update logic includes cache invalidation

### High Cache Miss Rate

**Symptoms:** Poor cache performance, high database load

**Resolution:**

1. Check if TTL is too short
2. Verify cache keys are consistent
3. Monitor cache hit ratio metrics
4. Consider increasing TTL for appropriate categories

### Memory Exhaustion

**Symptoms:** Redis out of memory errors, eviction triggered

**Resolution:**

1. Check maxmemory configuration
2. Monitor memory usage
3. Adjust eviction policy
4. Consider adding Redis cluster for scale

### Cache Keys Not Expiring

**Symptoms:** Cache grows indefinitely, stale data persists

**Resolution:**

1. Verify TTL is set correctly
2. Check Redis config for TTL configuration
3. Monitor key expiration
4. Ensure code passes TTL parameter

## Testing Cache

### Unit Tests

```typescript
describe("Cache Layer", () => {
  it("should cache shift data", async () => {
    await setCache("shift:dept-123:2026-06-15:day", data);
    const cached = await getCache("shift:dept-123:2026-06-15:day");
    expect(cached).toEqual(data);
  });

  it("should respect TTL", async () => {
    await setCache("key", data, { ttl: 1 });
    await wait(1100);
    const cached = await getCache("key");
    expect(cached).toBeNull();
  });
});
```

### Integration Tests

Test cache behavior with real Redis instance:

- Cache hits and misses
- TTL expiration
- Cache invalidation
- Concurrent access

## Performance Impact

### Expected Improvements

- **Shift Completeness Query:** 80% reduction in database load
- **Department Context:** 95% reduction in database load
- **Overall Dashboard Load:** 40-50% faster initial load

### Benchmarks

Without cache:

- Shift completeness query: 200-300ms
- Department context query: 50-100ms
- Dashboard load: 1-2s

With cache:

- Shift completeness (hit): 1-5ms
- Department context (hit): <1ms
- Dashboard load: 500-800ms

## Security Considerations

### Cache Data Protection

- **Sensitive Data:** Avoid caching sensitive data (PIN hashes, secrets)
- **Encryption:** Consider encryption for sensitive cached data
- **Access Control:** Redis should be secured (network, authentication)

### Cache Poisoning Protection

- **Validation:** Validate cache data structure before use
- **Type Checking:** Ensure cached data matches expected schema
- **Fallback:** Graceful degradation if cache corrupted

## Migration Strategy

### Cache Migration

When changing cache structure:

1. Add new cache version to key (e.g., `v2:shift:...`)
2. Migrate existing data to new format
3. Update application to use new version
4. Monitor for issues
5. Remove old version after validation

### Cache Warming for Production

After deployment:

1. Warm critical caches (department context)
2. Monitor cache hit ratio
3. Address any cache misses
4. Validate performance improvements

## Contact Information

- **Cache Administrator:** [Contact details]
- **Redis Administrator:** [Contact details]
- **Development Team:** [Contact details]

## Related Documentation

- **Architecture Documentation:** System overview
- **Data Flow Diagrams:** Cache flow patterns
- **Performance Optimization:** Performance tuning
- **Troubleshooting Guide:** Cache issues

---

**Last Review:** 2026-06-15  
**Next Review:** 2026-09-15 (quarterly)
