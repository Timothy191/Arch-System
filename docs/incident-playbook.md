# Incident Response Playbooks

## Severity Levels

| Level         | Response Time | Example                    |
| ------------- | ------------- | -------------------------- |
| P1 - Critical | Immediate     | Complete outage, data loss |
| P2 - High     | 1 hour        | Major feature broken       |
| P3 - Medium   | 4 hours       | Performance degradation    |
| P4 - Low      | 24 hours      | Minor issues, cosmetic     |

---

## Playbook 1: Database Outage

### Detection

- Portal returns 500 errors
- `curl http://127.0.0.1:54321` fails

### Response

1. **Check Docker**: `docker ps` - is Supabase running?
2. **Check logs**: `docker logs supabase-db`
3. **Restart if needed**:

   ```bash
   pnpm --filter @repo/database supabase:dev
   ```

### Post-Incident

- Check for data loss
- Review slow query logs (`SELECT * FROM get_slow_queries(10)`)
- Update runbook if new root cause found

---

## Playbook 2: Authentication Failures

### Detection

- Users unable to log in
- "Session expired" errors

### Response

1. **Check Supabase Auth status**
2. **Verify env vars**:

   ```bash
   grep SUPABASE .env
   ```

3. **Check RLS policies** not blocking access

### Post-Incident

- Review auth logs in Supabase dashboard
- Check for rate limiting

---

## Playbook 3: High Error Rate

### Detection

- Sentry shows spike in errors
- `/api/health` returns errors

### Response

1. **Identify error type**: Check Sentry for common pattern
2. **Check recent deployments**: Any new code?
3. **Check dependencies**: Any npm package issues?
4. **Rollback if needed**:

   ```bash
   git checkout <previous-commit>
   pnpm build
   ```

---

## Playbook 4: Performance Degradation

### Detection

- Slow page loads
- API latency > 2s

### Response

1. **Check slow queries**:

   ```sql
   SELECT * FROM get_slow_queries(20);
   ```

2. **Check Redis cache**:

   ```bash
   redis-cli info stats | grep hit
   ```

3. **Check database connections**

---

## Playbook 5: Data Integrity Issue

### Detection

- Reports showing incorrect data
- User reports data mismatch

### Response

1. **Identify affected table(s)**
2. **Check recent migrations**
3. **Verify RLS policies**:

   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'affected_table';
   ```

4. **Restore from backup** if critical

---

## Escalation

| P1                    | P2         | P3/P4      |
| --------------------- | ---------- | ---------- |
| Call on-call engineer | Slack #ops | Email team |

---

## Post-Incident Review Template

1. **What happened?**
2. **When detected?**
3. **Root cause?**
4. **Resolution?**
5. **Prevent recurrence?**
