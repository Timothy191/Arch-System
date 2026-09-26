# apps/portal/app/api/tools/

## Responsibility

Expose tool-related API endpoints for the portal. Currently provides external tool health status.

## Design

- Uses Next.js App Router route handlers under `app/api/tools/`.
- `status/route.ts` is the only implemented route in this group.
- Health checks are derived from `EXTERNAL_TOOLS` and returned as a flat array of status objects.
- Responses are cached with `cacheWrap` to avoid repeated external checks.

## Flow

1. `GET /api/tools/status` authenticates via Supabase server client.
2. If unauthenticated, returns `401 Unauthorized`.
3. Otherwise, maps each configured external tool through `checkToolHealth`.
4. `checkToolHealth` sends a `HEAD` request with a 3-second abort timeout.
5. Result status is `online`, `offline`, or `unknown`; response time is measured in milliseconds.
6. The array is cached for 60 seconds under `tools:status` and returned as `{ tools }`.

## Integration

- Reads tool definitions from `~/lib/tools` (`EXTERNAL_TOOLS`).
- Uses `@repo/supabase/server` for auth.
- Uses `@repo/redis` for response caching.
- Consumed by portal UI for tool availability dashboards or status panels.
