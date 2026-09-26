---
title: Monitoring and Error Tracking
created: 2026-05-15
updated: 2026-05-17
type: concept
tags: [infrastructure, system, application, concept]
sources: [raw/codebase/monitoring.md]
confidence: high
---

# Monitoring and Error Tracking

The portal uses Sentry for error tracking and Supabase real-time channels for live operational data. Satellite monitoring adds Copernicus STAC integration for geospatial analysis.

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

`instrumentation.ts` — Server-side Sentry initialization:

```typescript
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_RUNTIME === "nodejs") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

export const onRequestError = Sentry.captureRequestError;
```

### Edge Runtime

Same `instrumentation.ts` file handles edge runtime via `process.env.NEXT_RUNTIME === "edge"` check.

### next.config.mjs

Wrapped with `withSentryConfig`:

```javascript
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
});
```

Environment variables:

- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## Supabase Real-Time

Live data updates use Supabase's `postgres_changes` subscriptions filtered by `department_id`.

### Pattern

```typescript
supabase
  .channel("table_changes")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "table_name",
      filter: `department_id=eq.${departmentId}`,
    },
    (payload) => {
      // Handle insert/update/delete
    },
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

## Prometheus & Grafana (Phase 3)

The Docker Compose stack includes a full metrics collection and visualization layer added in Phase 3.

### Services

| Service    | Port   | Purpose                       |
| ---------- | ------ | ----------------------------- |
| Prometheus | `9090` | Metrics scraping and alerting |
| Grafana    | `9091` | Dashboard visualization       |

Both are started automatically via `./scripts/deploy.sh local`.

### Prometheus Configuration

`monitoring/prometheus.yml` defines scrape targets:

```yaml
scrape_configs:
  - job_name: portal
    static_configs:
      - targets: ["portal:3000"]
    metrics_path: /api/metrics

  - job_name: redis
    static_configs:
      - targets: ["redis-exporter:9121"]

  - job_name: postgres
    static_configs:
      - targets: ["postgres-exporter:9187"]
```

### Key Metrics Tracked

| Metric                          | Type      | Description                           |
| ------------------------------- | --------- | ------------------------------------- |
| `http_request_duration_seconds` | Histogram | API route latency                     |
| `ai_provider_requests_total`    | Counter   | Requests per AI provider              |
| `ai_provider_errors_total`      | Counter   | Failover events                       |
| `ai_cache_hit_ratio`            | Gauge     | Redis cache hit rate for AI responses |
| `db_query_duration_seconds`     | Histogram | PostgreSQL query latency              |
| `active_websocket_connections`  | Gauge     | Live real-time subscribers            |

### Grafana Dashboards

Access at `http://localhost:9091` (admin / admin on first run).

Pre-configured dashboards:

- **Portal Overview** — request rates, error rates, response time p50/p95/p99
- **AI Service** — provider usage, failover frequency, cache hit rate
- **Database** — query latency, connection pool usage, slow queries
- **Redis** — hit rate, memory usage, evictions

### Alerting Rules

Prometheus alert thresholds defined in `monitoring/prometheus.yml`:

| Alert                | Condition                      | Severity |
| -------------------- | ------------------------------ | -------- |
| `HighErrorRate`      | HTTP 5xx rate > 5% for 5min    | critical |
| `SlowAPIResponse`    | p95 latency > 2s for 5min      | warning  |
| `AIProviderFailover` | Failover events > 3 in 1min    | warning  |
| `DBSlowQuery`        | p99 query > 200ms for 10min    | warning  |
| `RedisCacheMiss`     | Cache hit rate < 60% for 15min | info     |

See [[on-premises-deployment]] for production monitoring setup and alert routing.

## Related

- [[portal-app-architecture]] — where monitoring hooks into the Next.js app
- [[database-schema]] — audit_logs table for application-level event tracking
- [[department-features]] — satellite monitoring API integration
- [[on-premises-deployment]] — production server monitoring setup
- [[ai-service]] — AI provider metrics tracked by Prometheus
