# apps/portal/app/api/plugins/

<!-- Plugin API routes for optional backend engines. Current example: rust-telemetry. -->

## Responsibility

- Hosts optional plugin API routes under `/api/plugins/*`.
- Each plugin exposes a POST endpoint that may call an external native engine when available.
- Falls back to an in-process JavaScript implementation when the native binary is absent or fails.
- Enforces auth via `createServerSupabaseClient()` and rate limiting via `withRateLimit`.

## Design

- One route file per plugin, co-located with its tests.
- Native execution path shells out to a compiled release binary under `plugins/<plugin>/target/release/...`.
- Fallback path computes deterministic telemetry-style results in JS and returns `isNative: false`.
- Shared error shape: on unexpected failure, returns a safe 200 fallback payload with `error` and `isNative: false`.

## Flow

- Client POSTs JSON to `/api/plugins/<name>`.
- Route authenticates the user, parses input, then chooses native vs JS path.
- Native path: `execFile` runs the compiled binary with CLI args; stdout is parsed as JSON.
- JS fallback path: derives `wearIndex`, `probability`, `rulHours`, and `status` from `hours`, `temp`, and `rpm`.
- Response always includes `isNative` so callers can distinguish engine source.

## Integration

- Depends on `@repo/supabase/server` for auth and `@/lib/api/rate-limit-middleware` for throttling.
- Depends on `@/lib/errors/error-logger` for structured error logging.
- Tests mock Supabase auth, `child_process.execFile`, and `fs.existsSync` to exercise both native and fallback branches.
