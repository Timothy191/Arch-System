# Runbook: Portal Service Down

**Severity**: P0 - Critical  
**Impact**: All users cannot access the portal  
**SLA**: Restore within 15 minutes

---

## Symptoms

- Health check alerts firing: `PortalDown`, `PortalHealthCheckFailed`
- Users report "Site cannot be reached" or 503 errors
- Grafana dashboard shows portal metrics flatlining
- Error rate spikes to 100%

---

## Immediate Actions (First 5 Minutes)

### 1. Verify the Outage

```bash
# Check health endpoint
curl -f http://localhost:3000/api/health

# Check if container is running
docker ps | grep arch-portal

# Check container logs
docker logs arch-portal --tail 100
```

### 2. Check Dependencies

```bash
# Supabase status
docker ps | grep supabase

# Redis status
docker ps | grep redis

# Nginx status
docker ps | grep nginx
```

### 3. Quick Restart Attempt

```bash
# Restart portal container
docker restart arch-portal

# Wait and verify
sleep 30
curl -f http://localhost:3000/api/health
```

---

## Diagnosis (Minutes 5-10)

### Check Container Health

```bash
# Full container inspection
docker inspect arch-portal --format '{{.State.Health.Status}}'

# Check exit code if crashed
docker inspect arch-portal --format '{{.State.ExitCode}}'

# Check OOM kills
docker inspect arch-portal --format '{{.State.OOMKilled}}'
```

### Check Resource Exhaustion

```bash
# Memory usage
docker stats arch-portal --no-stream

# Disk space
df -h

# Check logs for OOM
dmesg | grep -i "killed process"
```

### Check Application Logs

```bash
# Full log tail
docker logs arch-portal --tail 500 --timestamps

# Search for specific errors
docker logs arch-portal 2>&1 | grep -E "(FATAL|ERROR|panic)" | tail 50

# Check for database connection errors
docker logs arch-portal 2>&1 | grep -i "connection refused" | tail 20
```

### Check Database Connectivity

```bash
# Test database connection from portal container
docker exec arch-portal wget --spider http://supabase-db:5432 || echo "DB unreachable"

# Check Supabase Kong
curl -f http://localhost:54321/rest/v1/employees?limit=1
```

### Check Redis Connectivity

```bash
# Test Redis from portal container
docker exec arch-portal redis-cli -h redis ping || echo "Redis unreachable"
```

---

## Recovery Procedures

### Scenario 1: Portal Container Crashed

```bash
# Check why it crashed
docker logs arch-portal --tail 200

# If OOM, increase memory limit in docker-compose.production.yml
# Then restart
docker compose -f docker-compose.production.yml up -d portal

# Verify
docker ps | grep arch-portal
curl -f http://localhost:3000/api/health
```

### Scenario 2: Database Connection Lost

```bash
# Restart Supabase stack
docker compose -f docker-compose.production.yml restart supabase-db supabase-kong

# Wait for DB to be ready
sleep 30

# Verify DB health
docker exec arch-supabase-db pg_isready -U postgres

# Restart portal
docker restart arch-portal
```

### Scenario 3: Redis Connection Lost

```bash
# Check Redis status
docker logs arch-redis --tail 50

# Restart Redis
docker restart arch-redis

# Verify
docker exec arch-redis redis-cli ping
```

### Scenario 4: Port Conflict

```bash
# Check what's using port 3000
ss -tlnp | grep 3000

# If conflict, stop conflicting process or change portal port
# Edit docker-compose.production.yml PORT variable
docker compose -f docker-compose.production.yml up -d portal
```

### Scenario 5: Disk Full

```bash
# Check disk usage
df -h

# Clean up old Docker images
docker image prune -af

# Clean up old logs
sudo journalctl --vacuum-time=2d

# Remove old backups if needed
ls -lh ../backups/database/daily/
```

### Scenario 6: Complete Stack Reset

```bash
# Full restart (last resort)
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d

# Wait for all services
sleep 60

# Verify all services
docker compose -f docker-compose.production.yml ps
```

---

## Post-Incident

### Verify Recovery

```bash
# Health check
curl -f http://localhost:3000/api/health | jq

# Run smoke tests
k6 run --vus 5 --duration 1m loadtests/portal-loadtest.js

# Check Grafana dashboard
# https://grafana.internal/d/portal-overview
```

### Document Incident

1. Create incident report in `docs/incidents/INCIDENT-YYYY-MM-DD.md`
2. Include:
   - Timeline of events
   - Root cause
   - Resolution steps
   - Preventive actions

### Update Monitoring

- Add new alert thresholds if needed
- Create dashboard panel for new metric
- Update runbook with new diagnosis step

---

## Escalation Matrix

| Time   | Action                                   |
| ------ | ---------------------------------------- |
| 5 min  | If not resolved, page on-call engineer   |
| 10 min | If not resolved, page platform team lead |
| 15 min | If not resolved, escalate to CTO         |

---

## Related Runbooks

- [Database Down](database-down.md)
- [Redis Down](redis-down.md)
- [High Error Rate](high-error-rate.md)
- [High Latency](high-latency.md)

---

## Contacts

| Role           | Name          | Contact |
| -------------- | ------------- | ------- |
| On-Call        | See PagerDuty | #oncall |
| Platform Lead  | @timothy191   | Slack   |
| Database Admin | TBD           | Slack   |
