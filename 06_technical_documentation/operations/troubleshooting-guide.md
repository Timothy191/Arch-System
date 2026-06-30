# Control Room Troubleshooting Guide

**Last Updated:** 2026-06-15  
**Version:** 1.0  
**Audience:** System Administrators, IT Support, SCADA Engineers

---

## Overview

This guide provides troubleshooting procedures for common issues in the Control Room system.

## Quick Reference

| Issue              | Symptom                | Likely Cause                  | Quick Fix                        |
| ------------------ | ---------------------- | ----------------------------- | -------------------------------- |
| Dashboard slow     | Loading takes >5s      | Cache miss, database slow     | Check Redis, restart cache       |
| SCADA offline      | Red indicator          | FUXA down, network issue      | Check FUXA status, network       |
| Shift won't close  | Validation error       | Missing data, validation rule | Check completeness, fix errors   |
| PIN locked         | Account locked message | 3 failed attempts             | Wait 15 min or reset PIN         |
| Alerts not showing | No alerts displayed    | Subscription issue            | Refresh page, check realtime     |
| Data not updating  | Stale information      | Realtime disconnected         | Check Supabase realtime, refresh |

## Troubleshooting Procedures

### 1. Dashboard Performance Issues

**Symptoms:**

- Dashboard takes >5 seconds to load
- Components loading slowly
- Intermittent slowness

**Investigation Steps:**

1. **Check Cache Status**

   ```bash
   redis-cli ping
   redis-cli info stats
   ```

   - Verify Redis is responding
   - Check cache hit ratio
   - Monitor memory usage

2. **Check Database Performance**
   - Run database health check: `/api/health`
   - Check query performance
   - Verify connection pool status

3. **Check Network Latency**
   - Ping database server
   - Check network bandwidth
   - Verify DNS resolution

**Resolution:**

**Redis Issues:**

- Restart Redis: `systemctl restart redis`
- Clear cache: `redis-cli FLUSHALL` (use with caution)
- Check memory: `redis-cli INFO memory`

**Database Issues:**

- Restart connection pool (if using pooler)
- Check for long-running queries
- Scale database if needed

**Network Issues:**

- Check network connectivity
- Verify firewall rules
- Contact network team

### 2. SCADA Integration Issues

**Symptoms:**

- SCADA panel shows "Offline" (red)
- Machine status not updating
- Connection status stuck on "Degraded"

**Investigation Steps:**

1. **Check FUXA Server Status**
   - Navigate to FUXA URL directly
   - Check if FUXA is responding
   - Review FUXA logs for errors

2. **Check Environment Variable**

   ```bash
   echo $NEXT_PUBLIC_FUXA_URL
   ```

   - Verify URL is correct
   - Check for typos or wrong environment

3. **Check CORS Configuration**
   - Verify FUXA allows iframe embedding
   - Check CORS headers
   - Review FUXA security configuration

4. **Check Network Connectivity**
   - Can portal reach FUXA server?
   - Check firewall rules
   - Verify DNS resolution

**Resolution:**

**FUXA Down:**

- Contact SCADA team
- Use cached data (automatic fallback)
- Monitor for recovery

**CORS Issue:**

- Add portal domain to FUXA allowed origins
- Update FUXA security configuration
- Restart FUXA if needed

**Network Issue:**

- Check network routing
- Verify firewall rules
- Contact network team

### 3. Shift Closeout Issues

**Symptoms:**

- Shift closeout button not working
- Validation errors on closeout
- PIN verification fails

**Investigation Steps:**

1. **Check Shift Completeness**
   - Navigate to Shift Coverage page
   - Verify all machines have entries
   - Check for validation errors

2. **Check PIN Status**
   - Verify supervisor has PIN set
   - Check if account is locked (3 failed attempts)
   - Verify PIN is correct

3. **Check Rate Limiting**
   - Verify Redis is available
   - Check rate limit counters
   - Reset if needed

**Resolution:**

**Missing Data:**

- Add missing machine operations
- Enter missing hourly loads
- Resolve validation errors

**PIN Locked:**

- Wait 15 minutes for automatic unlock
- Or reset PIN via admin interface
- Contact IT if reset needed

**Rate Limited:**

- Wait 1 minute for rate limit reset
- Or clear rate limit counter in Redis
- Check if legitimate user activity or abuse

### 4. Real-time Update Issues

**Symptoms:**

- Machine status not updating in real-time
- Alerts not appearing automatically
- Shift status changes not reflecting

**Investigation Steps:**

1. **Check Supabase Realtime Status**
   - Run health check: `/api/health/supabase-realtime`
   - Verify realtime is connected
   - Check for subscription errors

2. **Check Browser Console**
   - Look for WebSocket errors
   - Check for reconnection attempts
   - Review subscription logs

3. **Check Network Connection**
   - Verify internet connectivity
   - Check for network interruptions
   - Test WebSocket connectivity

**Resolution:**

**Realtime Disconnected:**

- Refresh the page to reconnect
- Check internet connection
- Verify Supabase status

**Subscription Errors:**

- Review subscription configuration
- Check for invalid table names
- Verify permissions

**Network Issues:**

- Check network stability
- Contact network team
- Use polling as fallback

### 5. Alert Management Issues

**Symptoms:**

- Alerts not appearing in Alert Panel
- Cannot acknowledge or dismiss alerts
- Alert count incorrect

**Investigation Steps:**

1. **Check Database**

   ```sql
   SELECT COUNT(*) FROM shift_completeness_alerts;
   ```

   - Verify alerts exist in database
   - Check resolved status
   - Review alert timestamps

2. **Check Alert Generation**
   - Review shift completeness check job logs
   - Verify job is running on schedule
   - Check for job errors

3. **Check Subscription**
   - Verify postgres_changes subscription is active
   - Check for subscription errors in console
   - Test by manually inserting alert

**Resolution:**

**No Alerts Generated:**

- Check job execution logs
- Verify database permissions
- Restart Inngest if needed

**Alerts Not Displaying:**

- Refresh page to re-establish subscription
- Check database connection
- Verify RLS policies

**Cannot Dismiss Alerts:**

- Check permissions
- Verify database update succeeds
- Check for browser console errors

### 6. Database Connection Issues

**Symptoms:**

- "Database connection failed" errors
- Slow query performance
- Connection pool exhaustion

**Investigation Steps:**

1. **Check Database Status**
   - Run health check: `/api/health`
   - Check connection pool status
   - Verify database is online

2. **Check Connection String**
   - Verify environment variables are set
   - Check for typos in connection string
   - Test connection manually

3. **Check Connection Pool**
   - Verify pool size is adequate
   - Check for connection leaks
   - Monitor pool usage

**Resolution:**

**Database Down:**

- Contact database administrator
- Check maintenance schedule
- Wait for database recovery

**Connection String Issue:**

- Verify environment variables
- Check for encoding issues
- Test connection manually

**Pool Exhaustion:**

- Increase pool size
- Check for connection leaks in code
- Restart application if needed

### 7. Redis Connection Issues

**Symptoms:**

- Cache misses (all requests hit database)
- Rate limiting not working
- PIN lockout not enforced

**Investigation Steps:**

1. **Check Redis Status**

   ```bash
   redis-cli ping
   ```

   - Verify Redis is responding
   - Check Redis logs for errors

2. **Check Connection String**
   - Verify `REDIS_URL` environment variable
   - Test connection manually
   - Check for authentication issues

3. **Check Memory**

   ```bash
   redis-cli INFO memory
   ```

   - Verify memory not exhausted
   - Check eviction policy
   - Monitor memory usage

**Resolution:**

**Redis Down:**

- Start Redis: `systemctl start redis`
- Check logs: `/var/log/12_distributed_cache_runtime/redis.log`
- Contact Redis administrator

**Connection Issue:**

- Verify connection string
- Check network connectivity
- Verify authentication

**Memory Exhausted:**

- Increase maxmemory in config
- Adjust eviction policy
- Clean up unused keys

### 8. Inngest Job Issues

**Symptoms:**

- Scheduled jobs not running
- Jobs failing with errors
- Job execution slow

**Investigation Steps:**

1. **Check Inngest Dashboard**
   - Verify jobs are registered
   - Check job execution history
   - Review error logs

2. **Check Job Configuration**
   - Verify cron expressions are correct
   - Check for syntax errors
   - Test job manually

3. **Check Database Permissions**
   - Verify service role has required permissions
   - Check RLS policies don't block service role
   - Test database access

**Resolution:**

**Job Not Running:**

- Verify job is registered in `/api/inngest`
- Check Inngest API key
- Review Inngest logs

**Job Failing:**

- Review error logs
- Fix database permissions
- Test job logic

**Job Slow:**

- Optimize database queries
- Add caching where appropriate
- Review job logic for inefficiencies

### 9. Performance Degradation

**Symptoms:**

- Overall system slowness
- API response times increasing
- Database query times high

**Investigation Steps:**

1. **Check Metrics**
   - Review Prometheus metrics
   - Check response time histograms
   - Monitor error rates

2. **Check Database Queries**
   - Identify slow queries
   - Review query plans
   - Check for missing indexes

3. **Check System Resources**
   - CPU usage
   - Memory usage
   - Disk I/O

**Resolution:**

**Slow Queries:**

- Add indexes to slow queries
- Optimize query logic
- Use caching for repeated queries

**High CPU:**

- Scale up resources
- Optimize code
- Check for infinite loops

**High Memory:**

- Check for memory leaks
- Optimize data structures
- Increase available memory

### 10. Data Integrity Issues

**Symptoms:**

- Orphaned records detected
- Invalid references in database
- Validation errors

**Investigation Steps:**

1. **Review Data Integrity Report**
   - Check latest weekly report
   - Review unresolved issues
   - Identify patterns

2. **Check Orphaned Record Detection Job**
   - Review job logs
   - Verify job is running
   - Check for false positives

3. **Manually Verify Data**
   - Query database for orphaned records
   - Verify if issues are real or false positives
   - Document findings

**Resolution:**

**Real Orphaned Records:**

- Correct invalid references
- Delete duplicate records
- Update missing references

**False Positives:**

- Adjust validation rules
- Update job logic
- Document as known issue

## Diagnostic Tools

### Health Check Endpoints

- **Overall Health:** `/api/health`
- **Supabase:** `/api/health/redis`
- **FUXA:** `/api/health/fuxa`
- **Realtime:** `/api/health/supabase-realtime`

### Logs

- **Application Logs:** Platform-specific logging
- **Inngest Logs:** Inngest dashboard
- **FUXA Logs:** FUXA server logs
- **Redis Logs:** `/var/log/12_distributed_cache_runtime/redis.log`

### Monitoring

- **Prometheus Metrics:** `/api/metrics/prometheus`
- **Grafana Dashboards:** Control Room monitoring
- **Alerting:** Prometheus alert manager

## Emergency Procedures

### System Outage

1. **Identify Scope**
   - Is it single component or system-wide?
   - Which users are affected?

2. **Declare Incident**
   - Notify stakeholders
   - Activate incident response team

3. **Implement Workarounds**
   - Use offline procedures
   - Use fallback modes
   - Manual processes

4. **Restore Service**
   - Fix root cause
   - Verify system is stable
   - Monitor for issues

5. **Post-Incident Review**
   - Document timeline
   - Identify improvement opportunities
   - Update procedures

### Data Corruption

1. **Stop Writes**
   - Stop all write operations
   - Prevent further corruption

2. **Backup Current State**
   - Export current data
   - Document corruption

3. **Restore from Backup**
   - Identify last good backup
   - Restore to that point

4. **Verify Data**
   - Check data integrity
   - Run validation checks
   - Test system functionality

5. **Resume Operations**
   - Enable writes
   - Monitor for issues

## Escalation Guidelines

| Severity | Time to Escalate | Escalate To |
| -------- | ---------------- | ----------- |
| Low      | 24 hours         | Team Lead   |
| Medium   | 4 hours          | Manager     |
| High     | 1 hour           | Director    |
| Critical | 15 minutes       | CTO/VP      |

## Contact Information

- **IT Support:** [Contact details]
- **Database Administrator:** [Contact details]
- **Redis Administrator:** [Contact details]
- **SCADA Team:** [Contact details]
- **Development Team:** [Contact details]

## Prevention

### Regular Maintenance

- **Daily:** Monitor health checks
- **Weekly:** Review performance metrics
- **Monthly:** Review cache performance
- **Quarterly:** Architecture review

### Proactive Monitoring

- Set up alerts for:
  - Health check failures
  - Error rate increases
  - Performance degradation
  - Cache hit ratio drops

### Documentation

- Keep documentation updated
- Document known issues
- Record resolutions
- Share knowledge

## Related Documentation

- **Architecture Documentation:** System overview
- **Data Flow Diagrams:** System flows
- **Caching Strategy:** Cache management
- **Performance Optimization:** Performance tuning
- **Alert Response Procedures:** Alert handling

---

**Last Review:** 2026-06-15  
**Next Review:** 2026-09-15 (quarterly)
