# Redis Distributed Cache and Runtime Guide

## 1. Caching & Distributed Architecture
This workspace utilizes Redis for low-latency offloading, rate limiting, and temporary task queues to support high-performance operations.

*   **Local Caching Port**: `127.0.0.1:6380` (mapped from the monorepo config).
*   **Source Folder**: `cache/` holds the configuration, Redis configs, and Docker Compose files.

---

## 2. Command Reference

| Task | Command |
|------|---------|
| Start Redis Dev Stack | `pnpm redis:dev` |
| View Redis Stack Status | `pnpm redis:status` |

---

## 3. Rate-Limiting Implementation
The `@repo/rate-limiter` package integrates with `@repo/redis` to provide sliding-window rate limiting on critical backend APIs.

```typescript
import { RateLimiter } from "@repo/rate-limiter";
import { getRedisClient } from "@repo/redis";

const redis = getRedisClient();
const limiter = new RateLimiter({
  redis,
  limit: 100, // requests
  duration: 60, // seconds
});

export async function checkRateLimit(ip: string) {
  const { success, limit, remaining, reset } = await limiter.limit(`ip:${ip}`);
  return success;
}
```

---

## 4. Offloading Constraints
To support the monorepo's **Offline-First Principle**:
* If the Redis connection drops, the system must degrade gracefully (fallback to database querying or memory caching) without crashing the application.
* Keep keys structured with namespaces (e.g. `shift:[id]:cache` or `rate-limit:ip:[ip]`) to prevent collision.
