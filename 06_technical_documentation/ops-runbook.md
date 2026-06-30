# Operations Runbook

## Quick Reference

| Command                                     | Purpose                 |
| ------------------------------------------- | ----------------------- |
| `pnpm dev`                                  | Start portal dev server |
| `pnpm --filter @repo/database supabase:dev` | Start Supabase local    |
| `pnpm build`                                | Full build              |
| `pnpm test`                                 | Run tests               |

---

## Common Issues

### Database Connection Refused

- **Cause**: Docker not running or Supabase not started
- **Fix**:
  1. Start Docker Desktop
  2. Run `pnpm --filter @repo/database supabase:dev`

### Types Not Updating

- **Cause**: Migration pushed but types not regenerated
- **Fix**: Run `pnpm --filter @repo/database supabase:gen` and restart TS server

### Auth Errors in Tests

- **Cause**: Mock not properly set up
- **Fix**: Ensure `createServerSupabaseClient` is mocked in test file

---

## Health Checks

### Check Service Health

```bash
# Portal
curl http://localhost:3000/api/health

# Supabase
curl http://127.0.0.1:54321/rest/v1/

# Redis
redis-cli -u redis://localhost:6379 ping
```

### Check Error Rates

```bash
# View recent Sentry errors
# Check Sentry dashboard for error trends
```

---

## Emergency Procedures

### Complete Service Restart

```bash
# 1. Stop all services (Ctrl+C in each terminal)
# 2. Restart Supabase
pnpm --filter @repo/database supabase:dev

# 3. Restart portal
pnpm dev
```

### Rollback Last Deployment

```bash
# Find previous stable commit
git log --oneline -10

# Checkout previous version
git checkout <commit-hash>

# Rebuild
pnpm build
```

---

## Monitoring

### Key Metrics

- **SLO Dashboard**: Check `current_slo_status` view in Supabase
- **Cost Alerts**: Run `node 08_developer_tooling/cost-monitor.mjs --notify`
- **Anomaly Detection**: Run `node 08_developer_tooling/anomaly-detector.mjs --notify`

### Log Locations

- **Application**: Sentry dashboard
- **Database**: Supabase dashboard logs
- **API**: Next.js console output
