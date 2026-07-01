# AGENT_TRACER.md — @repo/logger

## Entry: 2026-06-16T21:45:00Z

**Purpose:** Created structured logging package with Pino for server-side and browser-compatible logging.

**Changes:**

- Created `pkgs/logger/` with package.json, tsconfig.json, .eslintrc.js
- `src/server.ts` — Pino logger with env-aware config (dev=pino-pretty, prod=JSON), secret redaction, child logger factory
- `src/browser.ts` — Thin structured JSON wrapper around console (avoids bundling Pino in browser)
- `src/next.ts` — Next.js App Router helpers: `createRouteLogger()` for request-scoped logging, `withLogging()` HOF for route handlers
- `src/types.ts` — `LogLevel` type and `Logger` interface
- `src/index.ts` — Barrel exports
- Updated `pkgs/eslint-toolchain/library.js` — added `no-console: warn` with allow list
- Added `pino` + `pino-pretty` to `pnpm-workspace.yaml` catalog
- Added `LOG_LEVEL=debug` to `apps/portal/.env`
- Wired first consumers: `apps/portal/app/api/health/route.ts` and `apps/portal/app/api/health/live/route.ts` via `withLogging()` HOF

**Next steps:**

- Replace `console.log` across API routes, Server Actions, and middleware with structured logger calls
- Consider adding Opentelemetry integration (pino-opentelemetry transport)
- Add query-level logging in database/service layers by injecting child logger
