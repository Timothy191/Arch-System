# Portal API Route Map

Generated from per-route `/init` pass. Each section summarizes route files, handlers, dependencies, tests, and blockers.

## admin

- **Files:** `apps/portal/app/api/admin/data/[table]/route.ts`, `apps/portal/app/api/admin/codemap.md`, `apps/portal/app/api/admin/data/codemap.md`
- **Handlers:** `GET`, `PUT`, `DELETE` on `[table]`
- **Dependencies:** `@repo/supabase/service-role`, `@repo/supabase/server`, `@repo/redis`, `@repo/rate-limiter`, `@/lib/api/rate-limit-middleware`
- **Tests:** `apps/portal/app/api/admin/data/[table]/route.test.ts`
- **Blockers:** none

## ai

- **Files:** `apps/portal/app/api/ai/metrics/route.ts`, `apps/portal/app/api/ai/codemap.md`, `apps/portal/app/api/ai/metrics/codemap.md`
- **Handlers:** `GET` in `metrics/route.ts`
- **Dependencies:** `@repo/supabase/server`, `@/lib/errors/error-logger`
- **Tests:** `apps/portal/app/api/ai/metrics/route.test.ts`
- **Blockers:** top-level `route.ts` absent; only metrics subroute exists

## audit

- **Files:** `apps/portal/app/api/audit/route.ts`, `apps/portal/app/api/audit/codemap.md`
- **Handlers:** `GET(request: Request)`
- **Dependencies:** `next/server`, `node:fs`, `node:path`
- **Tests:** `apps/portal/app/api/audit/route.test.ts`
- **Blockers:** none

## auth

- **Files:** `apps/portal/app/api/auth/login/route.ts`, `apps/portal/app/api/auth/login/route.test.ts`, `apps/portal/app/api/auth/codemap.md`
- **Handlers:** `POST(request: NextRequest)`
- **Dependencies:** `@repo/supabase/server`, `@/lib/api/rate-limit-middleware`, `next/server`
- **Tests:** `apps/portal/app/api/auth/login/route.test.ts`
- **Blockers:** none

## c66

- **Files:** `apps/portal/app/api/c66/route.ts`, `apps/portal/app/api/c66/route.test.ts`, `apps/portal/app/api/c66/codemap.md`
- **Handlers:** `POST(request: Request)`, internal `handlePost`, `logAccess`
- **Dependencies:** `@repo/supabase/service-role`, `next/server`, `@/lib/errors/error-logger`, `@/lib/api/response`, `@/lib/api/cors`, `@/lib/api/body-limit`, `@repo/contract/schemas/scanner.schema`
- **Tests:** `apps/portal/app/api/c66/route.test.ts`
- **Blockers:** none

## codebase-maps

- **Files:** `apps/portal/app/api/codebase-maps/route.ts`, `apps/portal/app/api/codebase-maps/route.test.ts`, `apps/portal/app/api/codebase-maps/codemap.md`
- **Handlers:** `GET(request: Request, options?: { mapsRoot?: string })`
- **Dependencies:** `next/server`, `node:fs`, `node:path`
- **Tests:** `apps/portal/app/api/codebase-maps/route.test.ts`
- **Blockers:** depends on external `codebase-maps` artifact tree

## control-room

- **Files:** `apps/portal/app/api/control-room/shift-completeness/route.ts`, `apps/portal/app/api/control-room/scada-status/route.ts`, `apps/portal/app/api/control-room/scada-status/route.test.ts`, `apps/portal/app/api/control-room/shift-completeness/route.test.ts`
- **Handlers:** `GET` in both subroutes
- **Dependencies:** `@repo/supabase/server`, `@/lib/shift-completeness`, `@repo/redis`, `@/lib/api/cors`
- **Tests:** `scada-status/route.test.ts`, `shift-completeness/route.test.ts`
- **Blockers:** none

## csp-violations

- **Files:** `apps/portal/app/api/csp-violations/route.ts`, `apps/portal/app/api/csp-violations/route.test.ts`, `apps/portal/app/api/csp-violations/codemap.md`
- **Handlers:** `POST(req: Request)`
- **Dependencies:** `@/lib/errors/error-logger`
- **Tests:** `apps/portal/app/api/csp-violations/route.test.ts`
- **Blockers:** none

## doc

- **Files:** `apps/portal/app/api/doc/route.ts`, `apps/portal/app/api/doc/route.test.ts`, `apps/portal/app/api/doc/codemap.md`
- **Handlers:** `GET()`, internal `assertAuthorizedUser()`
- **Dependencies:** `next/server`, `next-swagger-doc`, `@repo/supabase/server`
- **Tests:** `apps/portal/app/api/doc/route.test.ts`
- **Blockers:** none

## export

- **Files:** `apps/portal/app/api/export/tires/route.ts`, `apps/portal/app/api/export/production/route.ts`, `apps/portal/app/api/export/machines/route.ts`, `apps/portal/app/api/export/fuel-logs/route.ts`, `apps/portal/app/api/export/fuel-logs/route.test.ts`, `apps/portal/app/api/export/tires/route.test.ts`, `apps/portal/app/api/export/production/route.test.ts`, `apps/portal/app/api/export/machines/route.test.ts`, `apps/portal/app/api/export/codemap.md`
- **Handlers:** `GET` in all subroutes
- **Dependencies:** `@repo/supabase/server`, `@/lib/api/rate-limit-middleware`, `@/lib/api/cors`, `@/lib/api/response`, `@repo/contract/schemas/export.schema`
- **Tests:** `fuel-logs/route.test.ts`, `tires/route.test.ts`, `production/route.test.ts`, `machines/route.test.ts`
- **Blockers:** no root `route.ts`; inconsistent schema usage across subroutes

## feedback

- **Files:** `apps/portal/app/api/feedback/route.ts`, `apps/portal/app/api/feedback/route.test.ts`, `apps/portal/app/api/feedback/codemap.md`
- **Handlers:** `POST(req: Request)`
- **Dependencies:** `next/server`, `@repo/logger`
- **Tests:** `apps/portal/app/api/feedback/route.test.ts`
- **Blockers:** none

## health

- **Files:** `apps/portal/app/api/health/route.ts`, `apps/portal/app/api/health/warmup/route.ts`, `apps/portal/app/api/health/supabase-realtime/route.ts`, `apps/portal/app/api/health/redis/route.ts`, `apps/portal/app/api/health/live/route.ts`, `apps/portal/app/api/health/fuxa/route.ts`, `apps/portal/app/api/health/cache/route.ts`, `apps/portal/app/api/health/route.test.ts`, `apps/portal/app/api/health/warmup/route.test.ts`, `apps/portal/app/api/health/supabase-realtime/route.test.ts`, `apps/portal/app/api/health/redis/route.test.ts`, `apps/portal/app/api/health/live/route.test.ts`, `apps/portal/app/api/health/fuxa/route.test.ts`, `apps/portal/app/api/health/cache/route.test.ts`
- **Handlers:** `GET` in all subroutes; `live` uses `withLogging`
- **Dependencies:** `@repo/supabase/server`, `@repo/redis`, `@repo/supabase/service-role`, `@repo/redis/cache`, `@repo/logger/next`
- **Tests:** all health routes tested
- **Blockers:** none

## inngest

- **Files:** `apps/portal/app/api/inngest/route.ts`, `apps/portal/app/api/inngest/route.test.ts`, `apps/portal/app/api/inngest/codemap.md`
- **Handlers:** `GET`, `POST`, `PUT` via `serve()`
- **Dependencies:** `inngest/next`, `@repo/utils/inngest`, multiple `@/lib/jobs/*`, `@/lib/reports/*`
- **Tests:** `apps/portal/app/api/inngest/route.test.ts`
- **Blockers:** none

## log

- **Files:** `apps/portal/app/api/log/route.ts`, `apps/portal/app/api/log/route.test.ts`, `apps/portal/app/api/log/codemap.md`
- **Handlers:** `POST(req: Request)`
- **Dependencies:** `@repo/logger`, `next/server`
- **Tests:** `apps/portal/app/api/log/route.test.ts`
- **Blockers:** none

## metabase

- **Files:** `apps/portal/app/api/metabase/embed/route.ts`, `apps/portal/app/api/metabase/embed/route.test.ts`
- **Handlers:** `GET(request: NextRequest)`
- **Dependencies:** `@repo/supabase/server`, `@/lib/api/rate-limit-middleware`, `node:crypto`, `next/server`
- **Tests:** `apps/portal/app/api/metabase/embed/route.test.ts`
- **Blockers:** none

## metrics

- **Files:** `apps/portal/app/api/metrics/route.ts`, `apps/portal/app/api/metrics/route.test.ts`, `apps/portal/app/api/metrics/prometheus/route.ts`, `apps/portal/app/api/metrics/prometheus/route.test.ts`, `apps/portal/app/api/metrics/codemap.md`
- **Handlers:** `GET()` in both routes
- **Dependencies:** `@repo/redis`, `@/lib/observability/simple-metrics`, `@/lib/observability/metrics`
- **Tests:** both routes tested
- **Blockers:** none

## ml

- **Files:** `apps/portal/app/api/ml/predictive-maintenance/route.ts`, `apps/portal/app/api/ml/predictive-maintenance/route.test.ts`, `apps/portal/app/api/ml/codemap.md`, `apps/portal/app/api/ml/predictive-maintenance/codemap.md`
- **Handlers:** `GET()`
- **Dependencies:** `next/server`, `@repo/supabase/server`, `@/lib/errors/error-logger`
- **Tests:** `apps/portal/app/api/ml/predictive-maintenance/route.test.ts`
- **Blockers:** top-level `route.ts` absent

## plugins

- **Files:** `apps/portal/app/api/plugins/rust-telemetry/route.ts`, `apps/portal/app/api/plugins/rust-telemetry/route.test.ts`, `apps/portal/app/api/plugins/codemap.md`
- **Handlers:** `POST(req: NextRequest)`, internal `handleTelemetryRequest`
- **Dependencies:** `@repo/supabase/server`, `@/lib/api/rate-limit-middleware`, `@/lib/errors/error-logger`, `child_process`, `fs`, `path`, `util`
- **Tests:** `apps/portal/app/api/plugins/rust-telemetry/route.test.ts`
- **Blockers:** none

## printers

- **Files:** `apps/portal/app/api/printers/route.ts`, `apps/portal/app/api/printers/[id]/route.ts`, `apps/portal/app/api/printers/scan/route.ts`, `apps/portal/app/api/printers/route.test.ts`, `apps/portal/app/api/printers/[id]/route.test.ts`, `apps/portal/app/api/printers/scan/route.test.ts`, `apps/portal/app/api/printers/codemap.md`, `apps/portal/app/api/printers/[id]/codemap.md`, `apps/portal/app/api/printers/scan/codemap.md`
- **Handlers:** `GET`, `POST`, `DELETE`
- **Dependencies:** `@repo/supabase/server`, `@/app/(departments)/access-card-actions/lib/printer-detection`, `next/server`
- **Tests:** all three routes tested
- **Blockers:** none

## scada

- **Files:** `apps/portal/app/api/scada/tags/route.ts`, `apps/portal/app/api/scada/tags/route.test.ts`
- **Handlers:** `GET(req: Request)`
- **Dependencies:** `@repo/redis`, `@/lib/api/cors`
- **Tests:** `apps/portal/app/api/scada/tags/route.test.ts`
- **Blockers:** none

## sync

- **Files:** `apps/portal/app/api/sync/playback/route.ts`, `apps/portal/app/api/sync/playback/route.test.ts`
- **Handlers:** `POST(req: NextRequest)`
- **Dependencies:** `@repo/utils/inngest`, `@repo/supabase/server`, `@repo/contract/schemas/sync.schema`, `@/lib/api/rate-limit-middleware`, `@/lib/api/response`, `@/lib/api/cors`, `@/lib/api/body-limit`, `@/lib/errors/error-logger`
- **Tests:** `apps/portal/app/api/sync/playback/route.test.ts`
- **Blockers:** none

## telemetry

- **Files:** `apps/portal/app/api/telemetry/push/route.ts`, `apps/portal/app/api/telemetry/push/route.test.ts`, `apps/portal/app/api/telemetry/drilling/route.ts`, `apps/portal/app/api/telemetry/drilling/route.test.ts`, `apps/portal/app/api/telemetry/drilling/stream/route.ts`, `apps/portal/app/api/telemetry/push/codemap.md`, `apps/portal/app/api/telemetry/drilling/codemap.md`, `apps/portal/app/api/telemetry/drilling/stream/codemap.md`
- **Handlers:** `POST` in `push` and `drilling`; `GET` in `drilling/stream`
- **Dependencies:** `@repo/redis`, `@repo/supabase/server`, `@repo/contract/validation`, `@repo/contract/schemas/drill.schema`, `@repo/contract/schemas/telemetry.schema`, `@/lib/api/cors`, `@/lib/api/body-limit`
- **Tests:** `push/route.test.ts`, `drilling/route.test.ts`
- **Blockers:** no root `route.ts`

## tools

- **Files:** `apps/portal/app/api/tools/status/route.ts`, `apps/portal/app/api/tools/status/route.test.ts`, `apps/portal/app/api/tools/codemap.md`
- **Handlers:** `GET(_request: NextRequest)`
- **Dependencies:** `@repo/supabase/server`, `@repo/redis`, `~/lib/tools`
- **Tests:** `apps/portal/app/api/tools/status/route.test.ts`
- **Blockers:** none

## weather

- **Files:** `apps/portal/app/api/weather/route.ts`, `apps/portal/app/api/weather/route.test.ts`, `apps/portal/app/api/weather/codemap.md`
- **Handlers:** `GET(): Promise<NextResponse>`
- **Dependencies:** `@/lib/weather-api`, `@/lib/errors/error-logger`, `@/lib/observability/tracing`, `react/cache`, `next/server`
- **Tests:** `apps/portal/app/api/weather/route.test.ts`
- **Blockers:** none

## webhooks

- **Files:** `apps/portal/app/api/webhooks/route.ts`, `apps/portal/app/api/webhooks/[id]/route.ts`, `apps/portal/app/api/webhooks/[id]/logs/route.ts`, plus tests for each
- **Handlers:** `GET`, `POST`, `PUT`, `DELETE`, `GET` on `[id]` and `[id]/logs`
- **Dependencies:** `@repo/supabase/server`, `@repo/contract/schemas/webhook.schema`, `@/lib/api/rate-limit-middleware`, `@/lib/api/response`, `@/lib/api/cors`, `next/cache`
- **Tests:** all three routes tested
- **Blockers:** none
