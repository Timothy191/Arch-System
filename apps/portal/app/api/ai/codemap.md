# apps/portal/app/api/ai/

## Responsibility

Hosts the portal's AI-related API routes. Currently provides usage metrics for the AI dashboard under `metrics/`.

## Design

- Next.js App Router route handlers.
- Read-oriented endpoints backed by Supabase through `@repo/supabase/server`.
- Errors are funneled through `@/lib/errors/error-logger` and returned as JSON.

## Flow

1. Incoming request reaches the route handler.
2. Handler creates a server Supabase client.
3. Query parameters are parsed and translated into filters.
4. Data is read from `ai_token_usage` and aggregated.
5. Response is returned as JSON; failures are logged and surfaced as `500`.

## Integration

- Consumed by dashboard/UI surfaces that need AI usage visibility.
- Depends on the `ai_token_usage` table and shared portal error/logging utilities.
