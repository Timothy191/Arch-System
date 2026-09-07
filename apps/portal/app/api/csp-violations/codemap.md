# apps/portal/app/api/csp-violations/

## Responsibility

Receives browser CSP violation reports and logs them for monitoring. This folder exists to collect violation telemetry before enforcing strict CSP.

## Design

- Single `POST` API route.
- Accepts JSON reports shaped like `{ "csp-report": { ... } }` or a direct report object.
- Defines a local `CspReport` interface matching common CSP report fields.
- Always returns `204 No Content`, even on malformed input, per CSP reporting expectations.
- Delegates logging to `@/lib/errors/error-logger` as structured error events.

## Flow

1. Parse request JSON.
2. Extract the report from `csp-report` or fallback keys.
3. If missing, return `204`.
4. Log violation details with context `csp_violation`.
5. Return `204`.
6. On any parse failure, still return `204`.

## Integration

- Consumes `logError` from `@/lib/errors/error-logger`.
- Intended to be referenced by CSP `report-uri` / `report-to` configuration elsewhere in the app.
