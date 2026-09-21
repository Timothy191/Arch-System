# Task Outline: Backend Security & Architecture Review

## Objective

Conduct a comprehensive backend review across all domains — Database/RLS, API Contracts, Security/Audit, Performance/Caching, DevOps/Tooling, Testing/QA, and Observability — to identify vulnerabilities, performance bottlenecks, compliance gaps, and architectural debt in the Next.js Monorepo Business Portal.

## Domain Decomposition

1. **Database/RLS**: 113 migrations, 20+ schema files, Row-Level Security policies, Kysely ORM, PostgreSQL/Superbase, access control (45+ tables), vector indexes, partitioning
2. **API/Contracts**: 26 API route groups, 20 Zod contract schemas, webhook infrastructure, sync metadata, rate limiting, CORS, request/response contracts
3. **Security/Audit**: OWASP ZAP scanning, service role key management, middleware auth, RLS extension safety, secrets rotation, P0 security fixes, access control dashboards
4. **Performance/Caching**: Redis cluster (3 nodes), rate limiter strategies, cache invalidation, pg_cron schedules, materialized views, vector index optimization, query performance
5. **DevOps/Tooling**: Docker Compose (6 compose files), Kubernetes HPA, Nginx reverse proxy, systemd services, CI/CD pipelines, deployment scripts, Terraform
6. **Testing/QA**: Database test suite (RLS safety, privilege escalation, migration rollback), k6 stress testing, migration integrity checks, index coverage tests
7. **Observability**: Prometheus scraping, Alertmanager routing, Grafana dashboards, Sentry error tracking, log aggregation, pgbouncer pooling

## Architectural Scope

The portal is a Next.js 16 App Router application with a monorepo structure (15 packages). The backend spans:

- **Apps**: `apps/portal` (Next.js frontend + API routes)
- **Packages**: `packages/supabase`, `packages/database`, `packages/contract`, `packages/redis`, `packages/rate-limiter`, `packages/errors`, `packages/logger`, `packages/eval`
- **Infrastructure**: Docker Compose, Kubernetes, Terraform, monitoring stack
- **Services**: Supabase (managed), Redis, ClickHouse, Flowise, Langfuse

## Real-World Council Perspectives

- Security audit must prioritize RLS policy correctness — 82+ migrations include RLS refinements, indicating ongoing security evolution
- The 113 migrations suggest rapid schema evolution requiring careful rollback safety analysis
- Rate limiting and caching are critical given the mining/industrial domain with high-throughput data
- The service role key management and middleware auth flow require deep security review
