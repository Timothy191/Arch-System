# apps/portal/app/api/ml/predictive-maintenance/

## Responsibility

Expose a GET endpoint that returns predictive-maintenance predictions for machines with frequent recent breakdowns.

## Design

Single GET handler. Authenticates via `createServerSupabaseClient()`, applies an in-route heuristic ML mock, and returns prediction objects. No external model endpoint is called.

## Flow

1. Authenticate the request.
2. Query non-deleted `breakdowns` from the last 30 days.
3. Count breakdowns per `machine_id`.
4. Flag machines with more than 2 breakdowns as high risk.
5. Fetch matching machine details from `machines`.
6. Return predictions with fixed confidence, reason text, and recommended action.

## Integration

Depends on `breakdowns` and `machines` tables through `@repo/supabase/server`. Returns JSON consumed by portal clients.
