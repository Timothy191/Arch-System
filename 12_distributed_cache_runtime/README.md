# Redis offload stack

Isolated local Redis for Arch portal caching and rate limiting — separate from any system Redis on `:6379`.

## Quick start

```bash
pnpm redis:dev      # start container (127.0.0.1:6380)
pnpm redis:status   # health check
pnpm redis:stop     # stop (data volume kept)
```

## Portal link

In `00_applications/portal/.env`:

```env
REDIS_URL=redis://127.0.0.1:6380
```

`pnpm dev` detects this URL and starts the offload stack when it is not already running.

## What gets offloaded

| Workload | Package / route |
|----------|-----------------|
| Middleware auth cache | `00_applications/portal/server/proxy.ts` |
| API rate limits | `00_applications/portal/lib/api/rate-limit-middleware.ts` |
| Dashboard cache | `@repo/redis` `cacheWrap` |
| Shift PIN lockout | `00_applications/portal/lib/shift-closeout.ts` |
| L2 cache layer | `01_platform_packages/redis/src/cache.ts` |

Verify: `curl -s http://localhost:3000/api/health | jq '.checks.redis'`

## Configuration

Copy `12_distributed_cache_runtime/.env.example` → `12_distributed_cache_runtime/.env` to change host port or memory cap.

## Layout

```
12_distributed_cache_runtime/
  docker-compose.yml   # arch-redis-offload container
  03_operations_automation/start.sh
  03_operations_automation/stop.sh
  03_operations_automation/status.sh
```

Legacy path `10_infrastructure_as_code/docker/compose.redis.yml` is deprecated — use this directory instead.
