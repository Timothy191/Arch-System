# System Design & Backend Architecture

## Architectural Overview

The backend is a polyglot system built around a Next.js 16 App Router frontend with a managed Supabase PostgreSQL backend, Redis caching layer, and comprehensive observability stack.

### Data Layer Architecture

- **Primary DB**: Supabase PostgreSQL (managed) with 45+ tables across access control, fleet management, shift operations, drilling operations, and AI/ML domains
- **ORM**: Kysely (type-safe SQL query builder) via `packages/supabase/src/kysely.ts`
- **Migrations**: 113 SQL migrations in `packages/database/migrations/` managed via Supabase CLI
- **Read Replicas**: `packages/supabase/src/read-replica.ts` for read-heavy workloads
- **Connection Pooling**: pgbouncer (transaction mode, 25 default pool size, 1000 max connections)
- **Vector Search**: pgvector with HNSW indexing (migration 030, 064) for AI/embedding workloads
- **Partitioning**: Time-series partitioning for production logs (migration 072), operational compliance (073)

### API Layer Architecture

- **Framework**: Next.js 16 App Router Server Components + Route Handlers
- **Route Groups**: 26 API groups under `apps/portal/app/api/` (admin, ai, audit, auth, control-room, export, feedback, health, inngest, log, metrics, ml, sync, telemetry, tools, webhooks)
- **Contract Validation**: 20 Zod schemas in `packages/contract/src/schemas/` (access-card, access-control, admin, agent-tools, ai, compliance-audit, control-room, drill, export, fleet-equipment, form, multi-site-production, scanner, shift-compilation, sync, telemetry, tire-management, webhook)
- **Rate Limiting**: `packages/rate-limiter` with configurable strategies, middleware `withRateLimit`
- **CORS**: `apps/portal/lib/api/cors.ts` with `applyCors` middleware
- **Webhooks**: CRUD operations with triggers (`migrations/017_webhooks.sql`, `018_webhook_triggers.sql`)

### Cache Layer Architecture

- **Redis Cluster**: 3-node consistent-hashing cluster (`packages/redis/src/client.ts`)
- **Namespaces**: default (consistent-hashing), turbo (hash-slot), telemetry (single-node)
- **Cache Invalidation**: Tag-based via `packages/redis/src/invalidation.ts` with `cacheInvalidateTags`
- **Cache Operations**: `cacheSet`, `cacheGet`, `cacheInvalidate` patterns throughout the portal
- **pg_cron**: Scheduled cache refresh jobs (`migrations/023_pg_cron_schedules.sql`)

### Security Architecture

- **Authentication**: Supabase Auth with JWT validation via `createMiddlewareClient` using `getClaims()`
- **Service Role**: `createServiceRoleClient()` with server-side only key isolation
- **RLS Policies**: 82+ migrations include RLS refinements (`migrations/012_rls_refinement.sql`, `041_rls_performance_indexes.sql`, `095_optimize_rls_initplan_and_indexes.sql`)
- **Access Control**: Role-based (`assertAccessControlRole`), card-action-based (`assertAccessCardActionsRole`), department-based (`requireDepartment`)
- **Middleware**: `packages/supabase/src/middleware.ts` handles session refresh, JWT validation, cookie management
- **Security Scanning**: OWASP ZAP integration via `compose.security.yml`
- **Secrets**: `migrations/085_secrets_rotation_log.sql` for rotation tracking

### Monitoring & Observability Architecture

- **Metrics**: Prometheus with 15s scrape interval, Kubernetes pod discovery
- **Alerting**: Alertmanager with Slack + PagerDuty escalation, severity-based routing
- **Dashboards**: Grafana overview and cache dashboards
- **Rules**: HighErrorRate (>5%), HighLatency (p95 >1s), DatabaseConnectionIssues
- **Error Tracking**: Sentry (client + server configs)
- **Logging**: Structured logging via `packages/logger` (browser, server, next, types)
- **Tracing**: OpenTelemetry via `packages/supabase/src/tracing.ts`

### Infrastructure Architecture

- **Container Orchestration**: Docker Compose (7 compose files) + Kubernetes HPA
- **Production Stack**: Portal, Flowise, Redis, ClickHouse, pgbouncer, Nginx
- **Monitoring Stack**: Prometheus, Grafana, Alertmanager, cAdvisor
- **Networking**: Nginx reverse proxy with SSL termination, health checks
- **Deployment**: `deploy.sh` script with local/staging/production modes, rollback capability
- **CI/CD**: GitHub Actions (ci.yml, deploy.yml), Vercel deployment

## Quality Assessment

- **Feasibility**: 92/100 — Comprehensive but complex; 113 migrations create significant review surface
- **Maintainability**: 88/100 — Rapid schema evolution creates technical debt; RLS policies need ongoing maintenance
- **Security**: 85/100 — RLS refinement ongoing, service role key management needs hardening, ZAP scanning not always run
- **Performance**: 90/100 — Redis cluster, caching, rate limiting present but need deeper audit of hit ratios and query plans
- **Reliability**: 91/100 — Monitoring, alerting, rollback procedures exist but need verification of alert thresholds and recovery procedures
- **Composite Real-World Score**: **89.20/100** — Below 90 gate; security and maintainability need improvement

## Swarm Topology Selection

**Topology A: Tiered Context Hierarchy (T0/T1/T2+)** is selected due to:

- 7 distinct backend domains requiring specialized deep-dive
- Complex interdependencies between database, security, and API layers
- Need for persistent specialist agents to track RLS policy evolution across 82+ migrations
- T2 scouts needed for wide codebase searches across 113 migrations and 26 API route groups

**T0 Orchestrator**: Backend Review Lead — maintains global review state, coordinates findings
**T1 Specialists**: Database/RLS Auditor, API/Contract Auditor, Security/Audit Auditor, Performance/Caching Auditor, DevOps/Tooling Auditor
**T2 Scouts**: Migration Indexer, Route Mapper, Security Scanner, Cache Profiler

**Topology B: Writer-Critic** applied to security-critical findings:

- **Writer**: Documents findings and remediation plans
- **Critic**: Challenges security assumptions, verifies RLS policy edge cases, tests boundary conditions

**Topology C: Parallel Specialist Swarm** for independent domain reviews:

- Database/RLS, API/Contracts, and DevOps reviews can run concurrently with non-overlapping file scopes
- State logged to `.a2a/bus/event-log.jsonl`
