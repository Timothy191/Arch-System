# apps/portal/app/api/export/

<!-- Responsibility: authenticated export endpoints for operational datasets -->

## Responsibility

- Provides read-only export access for operational data under `/api/export/*`.
- Each route returns JSON by default and CSV when `Accept: text/csv` is present.
- Common contract: auth via Supabase server client, query validation, rate limiting, CORS, and paginated dataset export.

## Design

- Shared export shape: `from`, `to`, `dept`, `limit`, `offset` query parameters validated by `exportQuerySchema`.
- CSV generation is local and defensive: `sanitizeCsvCell()` escapes formula-injection characters and quotes.
- Routes are thin handlers: auth → validate → query → serialize → respond.
- `tires` is the outlier: it uses explicit `type` and `format` params and parallel fetches for tires + inspections.

## Flow

1. `GET` handler applies `with_rate_limit`.
2. Handler creates a server Supabase client and rejects unauthenticated requests with `401`.
3. Query params are parsed and validated; date range defaults to the last 30 days when omitted.
4. Data is fetched from `daily_logs` with nested related records where applicable.
5. Response is serialized to JSON or CSV based on `Accept` or explicit format params.
6. `applyCors()` is applied before returning.

## Integration

- Depends on `@repo/supabase/server`, `@repo/contract/schemas/export.schema`, and portal API middleware (`rate-limit-middleware`, `cors`, `response`).
- `production`, `machines`, and `fuel-logs` export paginated `daily_logs` data; `tires` exports tire registry and inspection/scrap datasets.
- CSV output is intended for direct download/audit workflows in the portal UI or external tooling.
