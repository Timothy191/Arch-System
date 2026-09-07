# apps/portal/app/api/log/

## Responsibility

Provides a single server-side ingestion point for client-side log events. It accepts structured log payloads from the browser and forwards them to the shared server logger.

## Design

- Single `POST` handler in `route.ts`.
- Expects JSON body with `level`, `msg`, `timestamp`, and `data`.
- Maps client log levels to server logger methods: `error`, `warn`, `info`, and `debug` for anything else.
- Prefixes forwarded messages with `[CLIENT]` so server logs can distinguish client-originated events.
- Attaches `clientTimestamp` and any extra `data` fields to the log metadata.
- Returns `{ success: true }` on success, or `{ success: false }` with HTTP 400 if the payload cannot be parsed.

## Flow

1. Client sends a `POST` request with a JSON log payload.
2. Route destructures `level`, `msg`, `timestamp`, and `data`.
3. A `switch` on `level` calls the corresponding `@repo/logger` method.
4. The log record includes `clientTimestamp` plus spread `data`, with a `[CLIENT]` prefixed message.
5. On success, the route responds with `200` and `{ success: true }`.
6. On parse failure, it logs the error server-side and responds with `400` and `{ success: false }`.

## Integration

- Depends on `@repo/logger` for server-side logging.
- Intended to be called from client-side logging utilities or instrumentation code.
- Sits under the portal API route tree and is exposed as `/api/log`.
