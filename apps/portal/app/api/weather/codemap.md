# apps/portal/app/api/weather/

## Responsibility

Exposes a single GET API route for current weather conditions at the mining site location. It is the portal’s weather data entrypoint and owns caching, observability, and graceful error degradation for that endpoint.

## Design

- Single-file route: `route.ts` exports `GET` and `dynamic = "force-dynamic"`.
- Caching is centralized in a module-scoped `getCachedWeather()` helper wrapped with React `cache(...)`, combined with Next.js response caching via `Cache-Control`.
- Observability is centralized through `withAsyncSpan`, `setAttributes`, and `addEvent`; errors are funneled through `logError`.
- Errors degrade gracefully to a `200` JSON `null` payload instead of failing the request, with short error-state caching and an `X-Error-ID` header.

## Flow

1. `GET` opens an async span named `weather_api_route`.
2. It sets cache-related tracing attributes, then calls `getCachedWeather()`.
3. On success, it returns weather JSON with `Cache-Control: public, s-maxage=300, stale-while-revalidate=300` and cache-hit telemetry/headers.
4. On failure, it logs the error, records error tracing attributes, and returns `null` with `Cache-Control: public, s-maxage=60` plus `X-Error-ID`.

## Integration

- Depends on `@/lib/weather-api` for actual weather fetching.
- Depends on `@/lib/errors/error-logger` for structured error logging.
- Depends on `@/lib/observability/tracing` for spans, attributes, and events.
- Returns `NextResponse.json(...)` for the portal API surface.
