# Runbook: Database Down

**Severity**: P0 - Critical  
**Impact**: All data operations fail, portal may be partially or fully unavailable  
**SLA**: Restore within 15 minutes

---

## Symptoms

- Alert firing: `DatabaseDown`, `DatabaseConnectionsHigh`
- Portal health check returns 503 with database check failed
- API calls returning 500 errors
- Grafana shows PostgreSQL metrics flatlining

---

## Immediate Actions (First 5 Minutes)

### 1. Verify Database Status

```bash
# Check container status
docker ps | grep supabase-db

# Check container health
docker inspect arch-supabase-db --format '{{.State.Health.Status}}'

# Check if PostgreSQL is accepting connections
docker exec arch-supabase-db pg_isready -U postgres
```

### 2. Check Database Logs

```bash
# Recent logs
docker logs arch-supabase-db --tail 100

# Search for fatal errors
docker logs arch-supabase-db 2>&1 | grep -E "(FATAL|PANIC|ERROR)" | tail 50

# Check for disk space issues
docker logs arch-supabase-db 2>&1 | grep -i "no space"
```

### 3. Quick Restart Attempt

```bash
# Restart database container
docker restart arch-supabase-db

# Wait for PostgreSQL to start
sleep 30

# Verify
docker exec arch-supabase-db pg_isready -U postgres
```

---

## Diagnosis (Minutes 5-10)

### Check Disk Space

```bash
# Check volume disk usage
docker system df -v | grep supabase_db_data

# Check host disk space
df -h

# Check database size
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT pg_size_pretty(pg_database_size('postgres'));"
```

### Check Connections

```bash
# Current connections
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Max connections
docker exec arch-supabase-db psql -U postgres -c \
  "SHOW max_connections;"

# Check for stuck queries
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query \
   FROM pg_stat_activity \
   WHERE state != 'idle' \
   ORDER BY duration DESC \
   LIMIT 10;"
```

### Check Replication (if configured)

```bash
# Replication status
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT * FROM pg_stat_replication;"

# Replication lag
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT client_addr, \
            pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) as lag \
   FROM pg_stat_replication;"
```

### Check for Locks

```bash
# Active locks
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT blocked_locks.pid     AS blocked_pid,
          blocked_activity.usename  AS blocked_user,
          blocking_locks.pid     AS blocking_pid,
          blocking_activity.usename AS blocking_user,
          blocked_activity.query    AS blocked_statement
   FROM  pg_catalog.pg_locks         blocked_locks
   JOIN  pg_catalog.pg_stat_activity blocked_activity  ON blocked_activity.pid = blocked_locks.pid
   JOIN  pg_catalog.pg_locks         blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
   WHERE blocked_locks.GRANTED IS FALSE;"
```

---

## Recovery Procedures

### Scenario 1: Database Container Crashed

```bash
# Check exit code
docker inspect arch-supabase-db --format '{{.State.ExitCode}}'

# If exit code 137, likely OOM - increase memory in docker-compose.production.yml
# Then restart
docker compose -f docker-compose.production.yml up -d supabase-db

# Wait for startup
sleep 30

# Verify
docker exec arch-supabase-db pg_isready -U postgres
```

### Scenario 2: Disk Full

```bash
# Clean up old WAL files
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT pg_walfile_name(pg_current_wal_lsn());"

# Vacuum database
docker exec arch-supabase-db psql -U postgres -c \
  "VACUUM FULL VERBOSE;"

# If still full, expand volume or clean backups
```

### Scenario 3: Too Many Connections

```bash
# Identify and terminate idle connections
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT pg_terminate_backend(pid) \
   FROM pg_stat_activity \
   WHERE state = 'idle' \
   AND query_start < now() - interval '30 minutes';"

# If persistent, increase max_connections in postgresql.conf
```

### Scenario 4: Corrupted Database

```bash
# Check database integrity
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT pg_catalog.pg_database_size('postgres');"

# If corrupted, restore from backup
# List available backups
ls -lht ../backups/database/daily/

# Restore latest backup (THIS WILL OVERWRITE DATA)
# See backup-db.sh for restore command
./scripts/backup-db.sh restore ../backups/database/daily/latest.sql.gz
```

### Scenario 5: PostgreSQL Won't Start

```bash
# Check for lock file
docker exec arch-supabase-db ls -la /var/lib/postgresql/data/postmaster.pid

# Remove stale lock file (only if container is stopped)
docker compose -f docker-compose.production.yml down
sudo rm -rf volumes/supabase_db_data/postmaster.pid
docker compose -f docker-compose.production.yml up -d supabase-db
```

### Scenario 6: Complete Database Recovery

```bash
# Stop all dependent services
docker compose -f docker-compose.production.yml down portal n8n flowise

# Start only database
docker compose -f docker-compose.production.yml up -d supabase-db supabase-kong

# Wait for database to be ready
sleep 60

# Verify database
docker exec arch-supabase-db pg_isready -U postgres

# Start dependent services
docker compose -f docker-compose.production.yml up -d
```

---

## Post-Recovery

### Verify Database Health

```bash
# Run health check
curl -f http://localhost:3000/api/health | jq

# Check all tables accessible
docker exec arch-supabase-db psql -U postgres -c \
  "\dt"

# Check recent migrations
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;"
```

### Verify Application Connectivity

```bash
# Portal can connect
docker exec arch-portal wget --spider http://supabase-db:5432

# Test a query
docker exec arch-portal psql -h supabase-db -U postgres -d postgres -c \
  "SELECT count(*) FROM employees;"
```

### Check Data Integrity

```bash
# Row counts for critical tables
docker exec arch-supabase-db psql -U postgres -c \
  "SELECT
    (SELECT count(*) FROM employees) as employees,
    (SELECT count(*) FROM users) as users;"
```

---

## Escalation Matrix

| Time   | Action                                   |
| ------ | ---------------------------------------- |
| 5 min  | If not resolved, page database admin     |
| 10 min | If not resolved, page platform team lead |
| 15 min | If not resolved, escalate to CTO         |

---

## Related Runbooks

- [Portal Down](portal-down.md)
- [Backup Failed](backup-failed.md)
- [Replication Lag](replication-lag.md)

---

## Contacts

| Role           | Name          | Contact |
| -------------- | ------------- | ------- |
| On-Call        | See PagerDuty | #oncall |
| Database Admin | TBD           | Slack   |
| Platform Lead  | @timothy191   | Slack   |
