# Redis offload stack

Isolated local Redis for Arch portal caching and rate limiting — separate from any system Redis on `:6379`.

## Quick start

```bash
pnpm redis:dev      # start container (127.0.0.1:6380)
pnpm redis:status   # health check
pnpm redis:stop     # stop (data volume kept)
```

## Portal link

In `apps/portal/.env`:

```env
REDIS_URL=redis://127.0.0.1:6380
```

`pnpm dev` detects this URL and starts the offload stack when it is not already running.

## What gets offloaded

| Workload | Package / route |
|----------|-----------------|
| Middleware auth cache | `apps/portal/server/proxy.ts` |
| API rate limits | `apps/portal/lib/api/rate-limit-middleware.ts` |
| Dashboard cache | `@repo/redis` `cacheWrap` |
| Shift PIN lockout | `apps/portal/lib/shift-closeout.ts` |
| L2 cache layer | `pkgs/redis/src/cache.ts` |

Verify: `curl -s http://localhost:3000/api/health | jq '.checks.redis'`

## Configuration

Copy `cache/.env.example` → `cache/.env` to change host port or memory cap.

## Layout

```
cache/
  docker-compose.yml   # arch-redis-offload container
  ops/start.sh
  ops/stop.sh
  ops/status.sh
```

Legacy path `infra/docker/compose.redis.yml` is deprecated — use this directory instead.
