---
title: Incident Response Playbook
created: 2026-05-15
updated: 2026-05-15
type: concept
tags: [incident, ops, production, on-call, emergency]
sources: [CLAUDE.md, wiki/concepts/deployment.md]
confidence: high
---

# Incident Response Playbook

Procedures for handling production incidents in the Arch-Systems portal.

---

## Severity Levels

| Level             | Impact                                           | Response Time | Example                                    |
| ----------------- | ------------------------------------------------ | ------------- | ------------------------------------------ |
| **P1 (Critical)** | Portal completely unavailable or data corruption | Immediate     | Database down, auth broken                 |
| **P2 (High)**     | Major feature broken, significant user impact    | < 1 hour      | AI service down, real-time updates failing |
| **P3 (Medium)**   | Partial degradation, workaround exists           | < 4 hours     | Slow queries, minor UI bugs                |
| **P4 (Low)**      | Cosmetic issues, no user impact                  | < 24 hours    | Typos, minor styling                       |

---

## Response Team

### On-Call Rotation

- **Primary**: [Team member name] - [Contact]
- **Secondary**: [Team member name] - [Contact]
- **Escalation**: Engineering Lead - [Contact]

### Communication Channels

- **Slack**: #incidents (for all updates)
- **Phone**: [Emergency number]
- **PagerDuty**: [If configured]

---

## Incident Lifecycle

### 1. DETECT (T+0)

**Sources**:

- Sentry alerts
- Uptime monitoring
- User reports
- Health check failures

**Immediate Actions**:

1. Acknowledge incident in #incidents Slack
2. Create incident document: `incidents/YYYY-MM-DD-brief-description.md`
3. Assess severity level
4. Page on-call if P1/P2

### 2. RESPOND (T+0 to T+30min)

**For All Severities**:

```bash
# 1. Check service status
curl https://portal.arch-systems.com/api/health

# 2. Check Vercel status
pnpm dlx vercel status

# 3. Check Supabase status
# Visit Supabase dashboard: https://supabase.com/dashboard
```

**For P1 (Critical) - Immediate Rollback Option**:

```bash
# If deployment caused issue, immediately rollback
pnpm dlx vercel --prod --target=PREVIOUS_DEPLOYMENT_ID
```

### 3. ASSESS (T+5min to T+1hour)

**Diagnostic Checklist**:

- [ ] Check Sentry for error spikes
- [ ] Review Vercel function logs
- [ ] Check Supabase connection limits
- [ ] Verify AI provider status pages
- [ ] Check external tools (n8n, Flowise) status

**Key Metrics to Check**:

```
Portal Response Time: Should be < 500ms
Error Rate: Should be < 1%
Database Connections: Should be < 80% of limit
Auth Success Rate: Should be > 99%
```

### 4. MITIGATE (T+30min to T+4hours)

**Common Incidents and Fixes**:

#### A. Portal Completely Down (P1)

**Symptoms**: 500 errors, timeout

**Steps**:

1. Check Vercel dashboard for failed deployments
2. Rollback to last known good deployment
3. Check if Supabase is reachable
4. Verify environment variables are set

**Rollback Command**:

```bash
# List recent deployments
pnpm dlx vercel list

# Rollback to previous
pnpm dlx vercel --prod --target=DEPLOYMENT_ID
```

#### B. Database Connection Issues (P1)

**Symptoms**: Queries failing, "connection refused"

**Steps**:

1. Check Supabase status page
2. Check connection limit in Supabase dashboard
3. Look for connection leaks in code
4. Consider restarting Supabase pooler

**Emergency Query**:

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Kill idle connections (if necessary)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' AND state_change < NOW() - INTERVAL '1 hour';
```

#### C. AI Service Down (P2)

**Symptoms**: AI chat fails, "Service unavailable"

**Steps**:

1. Check provider status pages
2. Verify API keys are valid
3. Check if failover is working
4. Switch to backup provider if needed

**Manual Failover**:

```typescript
// In apps/portal/lib/ai/ai-service.ts
// Temporarily switch primary provider
const providerOrder = ["openrouter", "together", "groq"];
```

#### D. Real-time Updates Broken (P2)

**Symptoms**: Dashboards not updating, stale data

**Steps**:

1. Check Supabase realtime logs
2. Verify channel subscriptions
3. Check for browser WebSocket issues
4. Restart Supabase realtime extension if needed

### 5. RESOLVE (T+4hours to T+24hours)

**For P1/P2**:

- Implement proper fix
- Deploy through staging first
- Monitor closely after deployment

**For P3/P4**:

- Schedule fix for next sprint
- Document in backlog

### 6. POST-INCIDENT (T+24hours to T+1week)

**Required for P1/P2**:

1. **Write Post-Mortem**:

```markdown
# Post-Mortem: [Incident Title]

Date: YYYY-MM-DD
Severity: P[X]
Duration: X hours

## Summary

Brief description of what happened

## Timeline

- T+0: Incident detected
- T+5min: Response started
- T+30min: Root cause identified
- T+2hours: Mitigated
- T+4hours: Resolved

## Root Cause

Detailed explanation

## Impact

- Users affected
- Data affected
- Features broken

## Lessons Learned

What went well, what didn't

## Action Items

- [ ] Fix X
- [ ] Add monitoring for Y
- [ ] Update runbook for Z
```

2. **Update Documentation**:

- Add incident to wiki if novel
- Update this playbook with new learnings
- Update [[troubleshooting]] if applicable

3. **Review and Share**:

- Schedule incident review meeting
- Share learnings with team
- Update on-call training

---

## Emergency Contacts & Resources

### Service Status Pages

- Vercel: <https://www.vercel-status.com>
- Supabase: <https://status.supabase.com>
- Groq: <https://status.groq.com>
- OpenRouter: <https://status.openrouter.ai>
- GitHub: <https://www.githubstatus.com>

### Access for Emergency

- **Vercel**: [Team admin email]
- **Supabase**: [Project owner email]
- **Sentry**: [Team admin email]
- **GitHub**: [Org admin email]

---

## Common Quick Fixes

### Restart Everything (Nuclear Option)

```bash
# If multiple services acting weird
pnpm --filter portal build
pnpm dlx vercel --prod  # Redeploy

# Database (emergency only)
cd packages/database
pnpm supabase stop
pnpm supabase:dev
```

### Database Emergency Queries

```sql
-- See what's running
SELECT pid, state, query_start, query
FROM pg_stat_activity
ORDER BY query_start DESC;

-- Kill a specific query
SELECT pg_terminate_backend(PID);
```

### Clear Caches

```bash
# Vercel cache
pnpm dlx vercel --force

# Local caches
rm -rf **/node_modules/.cache
rm -rf **/.next/cache
```

---

## Prevention Checklist

Before every production deployment:

- [ ] Staging tests passed
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] On-call person notified
- [ ] Deployment window appropriate (avoid peak hours)

---

## Related

- [[deployment]] — Deployment procedures
- [[troubleshooting]] — Common issues
- [[monitoring-error-tracking]] — Observability setup
