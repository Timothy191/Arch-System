# apps/portal/app/api/inngest/

## Responsibility

Expose the Inngest webhook endpoint for the portal app and register background job functions that Inngest invokes.

## Design

- Uses `serve()` from `inngest/next` to create a route handler.
- Wires a shared `inngest` client from `@repo/utils/inngest`.
- Exposes `GET`, `POST`, and `PUT` handlers.
- Declares all supported functions in one `functions` array.

## Flow

1. Inngest sends requests to this API route.
2. The handler delegates to the Inngest client.
3. Inngest matches the request to one of the registered functions and executes it.

## Integration

- Depends on `@repo/utils/inngest` for the client.
- Registers job functions from:
  - `@/lib/jobs/sync-playback`
  - `@/lib/jobs/report-generation`
  - `@/lib/jobs/embedding-generation`
  - `@/lib/jobs/memory-persist`
  - `@/lib/jobs/shift-completeness-check`
  - `@/lib/jobs/orphaned-record-detection`
  - `@/lib/reports/shift-integrity`
  - `@/lib/jobs/shift-rollover-notification`
  - `@/lib/jobs/daily-pdf-report-generation`
  - `@/lib/jobs/machine-breakdown-notification`
