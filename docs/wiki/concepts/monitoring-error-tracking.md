---
title: Monitoring and Error Tracking
created: 2026-05-15
updated: 2026-11-25
type: concept
tags: [infrastructure, system, application, concept, observability]
sources:
  [
    apps/portal/components/observability/ObservabilityConsole.tsx,
    infra/monitoring/docker-compose.yml,
    apps/portal/instrumentation.ts,
  ]
confidence: high
---

# Monitoring and Error Tracking

The portal pairs a **Native Observability & CI Console** (`/admin/observability` and `/overview`) with **OpenTelemetry (OTel)**, **Prometheus**, **light-mode Grafana**, **Woodpecker CI**, **VibeMon `v32`**, **Sentry v10**, and **Supabase Realtime CDC** (`useSupabaseRealtime`) for end-to-end operational telemetry.

## Native Observability & CI Console (`/admin/observability`)

Built on `@repo/contract/schemas/observability-layer.schema`, the portal exposes authenticated dual-mode BFF routes (`/api/observability/summary` and `/api/observability/ci`) backing `ObservabilityConsole.tsx`:

- **Golden Signals**: Latency (p50/p95/p99), traffic (req/s), error ratio, and saturation across portal routes, Supabase, and Redis.
- **Container & Collector Health**: Live health checks for `plantcor-otel-collector` (`:4318` / `:13133`), `plantcor-prometheus` (`:9090`), and `plantcor-grafana` (`:3005`, configured with `GF_DEFAULT_THEME=light`).
- **CI Pipeline & 6-Check Gatekeeper Telemetry**: Displays Woodpecker CI pipeline status alongside the local 28-gate `pnpm agent:verify` + `pnpm ci:gatekeeper` status checks (`Quality Gates`, `Policy Check`, `Dead Code Detection`, `Dependency Lint`, `Security Audit`, `Tier 2 Review Policy Check`).
- **VibeMon Multi-Agent Pulse (`/api/health/vibemon`)**: Tracks active coding agent sessions, task budgets, and Work State v1 handoffs in `AgenticMonitor.tsx`.

## Sentry Integration

Sentry is configured via `@sentry/nextjs` v10 across three runtime contexts:

### Browser (Client)

`sentry.client.config.ts` — Initializes Sentry in the browser with PII filtering:

```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filter PII from error reports
    if (event.exception) {
      // Scrub password/token strings
    }
    return event;
  },
});
```

Filters: password, token strings from error reports.

### Server (Node.js)

`sentry.server.config.ts` — Server-side Sentry initialization (DSN resolved from `SENTRY_DSN`, falling back to `NEXT_PUBLIC_SENTRY_DSN`), including header scrubbing for `authorization`, `cookie`, and `x-internal-secret`.

`instrumentation.ts` loads that file during `register()` and forwards request errors:

```typescript
async function initializeSentry(): Promise<void> {
  if (!resolveSentryDsn()) return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
```

### Edge Runtime

`sentry.edge.config.ts` mirrors the Node config (same DSN fallback, sample rate, and header scrubbing) and is loaded from the same `register()` branch.

### Request error forwarding

`onRequestError` calls `Sentry.captureRequestError(err, { path, method, headers }, { routerKind, routePath, routeType })` whenever a DSN is configured, before the structured Pino log and `system_logs` persistence.

### next.config.mjs

Wrapped with `withSentryConfig`:

```javascript
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/api/sentry-proxy',
  hideSourceMaps: true,
  disableLogger: true,
});
```

The tunnel rewrite is injected by `withSentryConfig` itself; there is no hand-written route handler for `/api/sentry-proxy`.

Environment variables:

- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## Supabase Real-Time

Live data updates use Supabase's `postgres_changes` subscriptions filtered by `department_id`.

### Pattern

```typescript
supabase
  .channel('table_changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'table_name',
      filter: `department_id=eq.${departmentId}`,
    },
    (payload) => {
      // Handle insert/update/delete
    }
  )
  .subscribe();
```

### Verified Department Scoping

All real-time subscriptions in the codebase filter by `department_id`:

- AlertPanel
- ScadaPanel
- ControlRoomActivityFeed
- HourlyLoadsGrid
- MachineOperationsList
- EngineeringNotesList
- OperationalDelaysList
- BreakdownsList

This ensures users only receive updates for data in their department (or accessible departments via `accessible_departments` array).

## Audit Logging

All mutations are logged to the `audit_logs` table via `logAuditEvent()` in `lib/audit.ts`.

Logged actions: `insert`, `update`, `delete`

Fields captured:

- `action` — Type of operation
- `table_name` — Target table
- `record_id` — Affected row UUID
- `old_data` — Previous state (JSONB)
- `new_data` — New state (JSONB)
- `performed_by` — Employee UUID (resolved from auth.users)
- `department_id` — Department context
- `ip_address` — Client IP (optional)
- `user_agent` — Client UA (optional)

See [[database-schema]] for the full `audit_logs` table definition.

## Satellite Monitoring API

`lib/monitoring-api.ts` provides geospatial data for the satellite monitoring department:

### Data Sources

| Source              | Type               | Cost |
| ------------------- | ------------------ | ---- |
| Copernicus STAC API | SAR/InSAR, Optical | Free |
| EOX WMTS            | Map tiles          | Free |

### Capabilities

- **Sentinel-1 SAR scene fetch**: `fetchSentinel1Scenes(bbox, days)` — Returns STAC items with polarisation data
- **Sentinel-2 optical fetch**: `fetchSentinel2Scenes(bbox, maxCloudCover, days)` — Returns cloud-filtered scenes
- **Deformation classification**: Classifies velocity (mm/month) into `stable` | `minor` | `moderate` | `critical` based on geotechnical thresholds
- **Map tile URLs**: WMTS templates for optical, terrain, SAR, NDVI, geology overlays

### Alert Thresholds

Velocity thresholds per area type (SRK/Slope Stability Radar standards):

| Area             | Minor   | Moderate | Critical |
| ---------------- | ------- | -------- | -------- |
| Pit wall         | 5 mm/mo | 15 mm/mo | 25 mm/mo |
| Tailings dam     | 3 mm/mo | 8 mm/mo  | 15 mm/mo |
| Haul road        | 8 mm/mo | 20 mm/mo | 35 mm/mo |
| Processing plant | 2 mm/mo | 5 mm/mo  | 10 mm/mo |

### STAC Integration

Copernicus STAC endpoint: `https://catalogue.dataspace.copernicus.eu/stac`

No API key required. Responses cached via Next.js `revalidate: 3600`.

## Prometheus & Grafana (Local Observability Stack)

There is exactly **one** local observability stack: `infra/monitoring/docker-compose.yml` (Compose project `plantcor-observability`). The former `infra/docker/compose.observability.yml` stack was removed to eliminate duplicate Grafana/Prometheus containers and port collisions.

### Services

| Service                 | Host port(s)                                  | Purpose                                          |
| ----------------------- | --------------------------------------------- | ------------------------------------------------ |
| OpenTelemetry Collector | `4317` (gRPC), `4318` (HTTP), `8889`, `13133` | OTLP intake → Tempo traces / Prometheus metrics  |
| Prometheus              | `9090`                                        | Metrics scraping, recording and alert rules      |
| Grafana                 | `3005`                                        | Light-mode dashboards (`GF_DEFAULT_THEME=light`) |
| Alertmanager            | `9093`                                        | Alert routing (default `null` receiver)          |
| cAdvisor                | `8082`                                        | Container CPU/memory/IO metrics                  |
| Loki                    | `3100`                                        | Log aggregation                                  |
| Tempo                   | `3200`                                        | Distributed traces (24h local retention)         |

Start or stop the core stack with `pnpm monitor:grafana` / `pnpm monitor:grafana-stop` (also wired into `./scripts/deploy.sh local` and `make up-monitoring`). The Woodpecker CI pair is available under the optional `ci` profile (`docker compose -f infra/monitoring/docker-compose.yml --profile ci up -d`).

### Prometheus Configuration

`monitoring/prometheus.yml` is the canonical local scrape config. It loads alert rules from `infra/observability/prometheus-rules/*.yaml` and scrapes:

- `prometheus` (`localhost:9090`), `cadvisor` (`:8080`), `otel-collector` (`:8889`), `loki` (`:3100`), `tempo` (`:3200`)
- `plantcor-portal` (`host.docker.internal:3000/api/metrics`)
- `plantcor-portal-control-room` (`host.docker.internal:3000/api/metrics/prometheus`)
- `kiro-agent` and `langfuse` (optional local AI tooling)

Supabase Cloud privileged metrics are intentionally disabled locally: the job needs a mounted service-role password file. The cluster/Kubernetes variant lives in `infra/observability/prometheus.yml` (pod service discovery + Supabase privileged scraping).

### Key Metrics Tracked

| Metric                                                    | Type      | Description                            |
| --------------------------------------------------------- | --------- | -------------------------------------- |
| `control_room_api_requests_total`                         | Counter   | Portal API requests by endpoint/status |
| `control_room_api_response_time_seconds_bucket`           | Histogram | API latency                            |
| `control_room_shift_closeout_duration_seconds_bucket`     | Histogram | Shift closeout latency                 |
| `control_room_scada_connection_status`                    | Gauge     | SCADA/FUXA connectivity (1/0)          |
| `control_room_data_integrity_score`                       | Gauge     | Data integrity score (0–100)           |
| `portal_cache_hits_total{source="l1"\|"l2"}`              | Counter   | Cache hits by tier                     |
| `portal_cache_misses_total` / `portal_cache_errors_total` | Counter   | Cache misses and Redis errors          |
| `portal_cache_latency_ms{metric="avg"\|"p95"}`            | Gauge     | Cache latency                          |
| `node_event_loop_delay_ms{quantile=…}`                    | Gauge     | Node.js 24 event-loop delay            |
| `node_v8_heap_used_bytes`                                 | Gauge     | V8 heap usage                          |

### Grafana Dashboards

Access at `http://localhost:3005` (admin / admin on first run; override with `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` in `infra/monitoring/.env`). Dashboards are provisioned from `infra/observability/grafana-dashboards/`:

- **Overview** — stack health and request rates
- **Control Room** — shift closeout p50/p95, SCADA p95, data integrity, active alerts, orphaned records, API request rate
- **Arch Portal** — golden-signal and Inngest job panels
- **Cache** — L1/L2 hit ratios and Redis latency
- **Supabase Cluster** — database health

### Alerting Rules

Rules live in `infra/observability/prometheus-rules/alerts.yaml` and `cache-alerts.yaml`, and reference only metrics the portal actually emits (e.g. `HighAPIErrorRate`, `ShiftCloseoutSlow`, `SCADAConnectionDown`, `CacheMissRateTooHigh`, `HighAPILatency`).

`infra/observability/alertmanager.yml` ships with a `null` default receiver so the stack starts without credentials. To deliver notifications, copy it to `infra/observability/alertmanager.local.yml` (gitignored), uncomment the Slack/PagerDuty receivers with real credentials, and set `ALERTMANAGER_CONFIG_PATH` before starting the stack. Alertmanager does not expand environment variables.

Alert-response steps are documented in `docs/operations/alert-response-procedures.md`.

### SLO Snapshot Persistence

In-memory uptime/alert state is periodically persisted to the `slo_metrics` table (migration `092_slo_monitoring.sql`):

- `GET /api/cron/observability-slo` (`*/15 * * * *` in `vercel.json`) probes Supabase, Redis, FUXA, and the Node runtime, appends heartbeat ticks, and writes one row per target (`slo_name = uptime:<targetId>`, target `99.9%`, 24h period, `success`/`warning`/`breached` status, remaining error budget).
- Writes use the service-role client and are best-effort: failures are returned in the response payload but never break observability reads.
- `/api/admin/observability` also snapshots the passive samples it already collects (deduplicated to one write per target per 10 minutes).
- Authenticated users can read history directly; the `current_slo_status` view returns the latest value/status per SLO.

## Related

- [[portal-app-architecture]] — where monitoring hooks into the Next.js app
- [[database-schema]] — audit_logs table for application-level event tracking
- [[department-features]] — satellite monitoring API integration
- [[on-premises-deployment]] — production server monitoring setup
- [[ai-service]] — AI provider metrics tracked by Prometheus
