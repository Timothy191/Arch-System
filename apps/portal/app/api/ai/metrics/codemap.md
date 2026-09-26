# apps/portal/app/api/ai/metrics/

## Responsibility

Serve AI token usage metrics for dashboard consumption.

## Design

- Single `GET /api/ai/metrics` handler.
- Supports scoped time windows: `session`, `24h`, `7d`, `30d`, `all-time`.
- Optional `department_id` filter narrows results.
- Returns a zeroed metrics payload when no usage rows are present.

## Flow

1. Parse `scope` and optional `department_id`.
2. Compute `startDate` from the selected scope.
3. Query `ai_token_usage`, ordered by `created_at` descending.
4. If rows exist, aggregate:
   - totals for tokens, prompt/completion/cached tokens, cost in USD/ZAR
   - cache hit ratio and tokens saved
   - request count and average latency
   - per-model breakdown with percentage share
   - recent usage limited to the last 20 requests
5. Return structured JSON; on error, log and return `500`.

## Integration

- Reads from `ai_token_usage`.
- Used by AI dashboard/metrics UI.
- Uses `@repo/supabase/server` for data access and `@/lib/errors/error-logger` for failure reporting.
