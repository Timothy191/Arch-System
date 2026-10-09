# api/webhooks/[id]/

**Kind:** api-route · **Files:** 2 (+2 test)

## Responsibility

Next.js App Router route handler serving `GET, PUT, DELETE` requests.
Route handlers own the HTTP contract: request parsing (Zod), authorization, rate limiting,
and JSON response shaping. Business logic stays in `lib/` or packages; no DB access from client components.

## Design

- HTTP methods: GET, PUT, DELETE
- Database tables touched: webhook_endpoints, webhook_delivery_logs
- Exports:
  - `route.ts` → PUT, DELETE

## Flow

Request → auth check → rate limit → parse body/params → validate (Zod) → execute (queue/RPC/service) → JSON response.
Errors are logged via `logError` and surfaced as structured JSON, never as silent 2xx.

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Consumed by the portal UI and/or the n8n workflow dispatcher (BullMQ `n8n-workflow-queue`).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
