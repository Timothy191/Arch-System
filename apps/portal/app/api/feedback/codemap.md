# apps/portal/app/api/feedback/

- `route.ts`: POST-only feedback submission endpoint.

## Responsibility

- Accept user-submitted feedback from the portal.
- Log feedback locally for observability.
- Return a synthetic ticket identifier for client confirmation.

## Design

- Single handler: `POST`.
- Request body fields: `type`, `message`, `userEmail`, `metadata`.
- External ticketing/Slack integrations are present as commented placeholders, not active behavior.
- Errors are caught in-route and returned as `{ success: false }` with HTTP 500.

## Flow

1. Parse JSON body.
2. Log feedback with `userEmail` and `metadata`.
3. Return `{ success: true, ticketId: "TKT-1234" }`.
4. On failure, log the error and return `{ success: false }` with status 500.

## Integration

- Uses `@repo/logger` for structured logging.
- No active external service calls; commented references to Zendesk/Jira and Slack indicate intended future integration points.
