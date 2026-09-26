# Database Optimization & Scaling

**Priority:** HIGH  
**Estimated Effort:** 3–4 days  
**Status:** ✅ Complete

> Implement table partitioning for time-series data, set up read replicas, add connection pooling via PgBouncer, optimize slow queries, and create materialized views for complex reports.

---

## Overview

The schema is production-ready (9/10 performance score) but designed for current load. As mining operations scale — more shifts, more machines, more real-time telemetry — these optimizations will maintain query performance and prevent bottlenecks.

---

## Current State

| Metric          | Current   | Target                 |
| --------------- | --------- | ---------------------- |
| Query p50       | 12ms      | < 10ms                 |
| Query p95       | 85ms      | < 50ms                 |
| Query p99       | 180ms     | < 100ms                |
| Cache Hit Rate  | 78%       | 85%+                   |
| Connection Pool | 45% usage | < 60% (with PgBouncer) |
| Tables          | 30+       | +partitioned variants  |
| Indexes         | 85+       | + materialized views   |

---

## Implementation Checklist

### 1. Table Partitioning (Time-Series Tables)

Partitioning divides large tables by time range so queries touching recent data skip older partitions.

**Priority tables for partitioning:**

- `hourly_loads` — daily machine-hour entries
- `daily_logs` — shift-level operational data
- `machine_hours` — per-machine utilization records
- `fuel_logs` — fuel consumption by shift/machine

**Migration approach:**

```sql
-- Example: partition hourly_loads by month
CREATE TABLE hourly_loads_partitioned (
  LIKE hourly_loads INCLUDING ALL
) PARTITION BY RANGE (date);

-- Create monthly partitions
CREATE TABLE hourly_loads_2026_01
  PARTITION OF hourly_loads_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- ... repeat for each month

-- Migrate data
INSERT INTO hourly_loads_partitioned SELECT * FROM hourly_loads;
```

- [x] Create migration `020_partition_time_series.sql` (hourly_loads + daily_logs)
- [x] Monthly partitions 2025-01 → 2027-12 auto-created in migration
- [x] `create_next_month_partitions()` function added (called by pg_cron)
- [x] RLS policies re-applied on partitioned tables using `has_department_access()`
- [ ] Benchmark query time before/after (run after first production deployment)

### 2. Read Replicas

Read replicas route `SELECT` queries away from the primary, reducing load for dashboard-heavy workloads.

**In Supabase local/self-hosted:**

```bash
# In docker-compose, add replica service:
postgres-replica:
  image: supabase/postgres:15.1.0.147
  environment:
    POSTGRES_PRIMARY_URL: postgresql://postgres:password@db:5432/postgres
  command: ["postgres", "-c", "hot_standby=on"]
```

- [x] `docker-compose.replica.yml` added (postgres-replica + postgrest-replica services)
- [x] `packages/supabase/src/read-replica.ts` created with env fallback to primary
- [x] `@repo/supabase/read-replica` export added to package.json
- [x] Hub page (`app/(hub)/page.tsx`) routed to read replica for dashboard SELECTs
- [x] Auth check remains on primary client
- [ ] Monitor replication lag (< 100ms target) — needs Grafana/Prometheus alert

### 3. Connection Pooling — PgBouncer

PgBouncer sits between the app and PostgreSQL, multiplexing connections and preventing connection exhaustion under concurrent load.

```yaml
# docker-compose addition
pgbouncer:
  image: pgbouncer/pgbouncer:1.21.0
  environment:
    DATABASES_HOST: db
    DATABASES_PORT: 5432
    DATABASES_DBNAME: postgres
    PGBOUNCER_POOL_MODE: transaction
    PGBOUNCER_MAX_CLIENT_CONN: 200
    PGBOUNCER_DEFAULT_POOL_SIZE: 25
  ports:
    - "5433:5432"
```

- [x] `docker-compose.pooler.yml` added (pgbouncer service on port 5433)
- [x] Pool mode: `transaction` (Supabase auth compatible)
- [x] `SUPABASE_READ_REPLICA_URL` added to `.env.example`
- [ ] Update `SUPABASE_DB_URL` in local `.env` to use port 5433 after starting pooler
- [ ] Monitor pool stats: `psql -h localhost -p 5433 -U postgres pgbouncer`
- [ ] Load test with 50 concurrent connections

### 4. Slow Query Optimization

- [x] `pg_stat_statements` enabled in migration `021_missing_indexes.sql`
- [x] `slow_queries_summary` view created for easy monitoring
- [x] Composite indexes added: `machine_hours`, `fuel_logs`, `daily_logs`, `hourly_loads`, `breakdowns`, `safety_incidents`, `machines`, `audit_logs`, `ai_memory_entries`
- [ ] Review `EXPLAIN ANALYZE` output for top queries after first week of production load
- [ ] Set `work_mem = 64MB` in `postgresql.conf` (requires server restart)

### 5. Materialized Views for Reports

Materialized views pre-compute expensive aggregations and refresh on a schedule.

**Priority views:**

```sql
-- Department summary (refreshed every 15 min)
CREATE MATERIALIZED VIEW dept_production_summary AS
SELECT
  d.id AS department_id,
  d.name,
  SUM(dl.total_tonnage) AS month_tonnage,
  AVG(dl.efficiency_rate) AS avg_efficiency,
  COUNT(dl.id) AS log_count
FROM departments d
JOIN daily_logs dl ON dl.department_id = d.id
WHERE dl.log_date >= date_trunc('month', NOW())
GROUP BY d.id, d.name;

CREATE UNIQUE INDEX ON dept_production_summary(department_id);

-- Refresh schedule (pg_cron)
SELECT cron.schedule('refresh-dept-summary', '*/15 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY dept_production_summary');
```

- [x] Migration `022_materialized_views.sql` created
- [x] `dept_production_summary` view (refreshes every 15 min)
- [x] `machine_utilization_weekly` view (refreshes every 1 hour)
- [x] `safety_incident_monthly` view (refreshes every 6 hours)
- [x] SECURITY DEFINER wrapper functions enforce RLS on all 3 views
- [x] `pg_cron` schedules added in migration `023_pg_cron_schedules.sql`
- [ ] Update dashboard server components to call `get_dept_production_summary()` etc. (next iteration)

---

## PostgreSQL Configuration Tuning

Add to `postgresql.conf` (or via Supabase settings):

```ini
# Memory
shared_buffers = 4GB          # 25% of RAM (for 16GB server)
effective_cache_size = 12GB   # 75% of RAM
work_mem = 64MB               # Per sort operation
maintenance_work_mem = 1GB    # For VACUUM/index builds

# Parallelism
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

# WAL
wal_compression = on
checkpoint_completion_target = 0.9
```

---

## Monitoring

Track optimization impact in Grafana:

- Dashboard: "PostgreSQL Slow Queries" panel
- Alert: p99 query time > 200ms
- Alert: replication lag > 500ms
- Alert: PgBouncer pool usage > 80%

---

## Related Pages

- [[database-schema|Database Schema]] — Full schema reference
- [[rls-policy|RLS Policy Standards]] — Ensure RLS works with partitioned tables
- [[monitoring-error-tracking|Monitoring & Error Tracking]] — Prometheus/Grafana setup
- [[SCHEMA_IMPROVEMENTS|Schema Improvements]] — Completed schema enhancements
