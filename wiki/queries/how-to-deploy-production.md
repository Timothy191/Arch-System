---
title: "Q: How do I deploy to production?"
created: 2026-05-15
updated: 2026-05-15
type: query
tags: [how-to, deployment, production, quick-reference]
sources: [wiki/concepts/deployment.md, wiki/concepts/incident-response.md]
confidence: high
---

# Q: How do I deploy to production?

## Quick Answer (Checklist)

```bash
□ pnpm lint              # Pass
□ pnpm type-check        # Pass
□ pnpm test              # Pass
□ pnpm build             # Pass
□ Review migrations      # Applied?
□ Check env vars         # Set?
□ Deploy to staging      # Test?
□ Deploy to production   # Ship!
```

---

## Pre-Deployment (Do These First)

### 1. Code Quality Gates

```bash
# Run from root
pnpm lint
pnpm --filter portal type-check
pnpm --filter portal test
```

**All must pass** before deploying.

### 2. Database Review

```bash
cd packages/database

# See pending migrations
pnpm supabase migration list

# Review the latest migration
cat migrations/$(ls -t migrations/*.sql | head -1)
```

Check for:

- [ ] RLS policies on new tables
- [ ] Indexes for performance
- [ ] No destructive operations (or planned)

### 3. Environment Variables

Verify production `.env`:

```bash
# Required
cat apps/portal/.env | grep NEXT_PUBLIC_SUPABASE_URL
cat apps/portal/.env | grep SUPABASE_SERVICE_KEY
cat apps/portal/.env | grep GROQ_API_KEY

# Should return values, not empty
```

---

## Deployment Methods

### Method A: Vercel CLI (Recommended)

```bash
# 1. Link to project (first time only)
pnpm dlx vercel link

# 2. Deploy to staging first
pnpm dlx vercel --target=staging

# 3. Test staging
# Visit https://staging-url.vercel.app
# Run smoke tests

# 4. Deploy to production
pnpm dlx vercel --prod
```

### Method B: Git Push (CI/CD)

```bash
# 1. Create PR
git checkout -b feature/my-feature
git push origin feature/my-feature
# Create PR on GitHub

# 2. CI runs automatically
# - Lint
# - Type check
# - Tests
# - Deploy preview

# 3. Merge to main
# Auto-deploys to production
```

### Method C: Database Only (Migrations)

```bash
# If only database changed, no code deploy needed
cd packages/database
pnpm supabase:push
```

---

## Step-by-Step: Full Deployment

### Step 1: Staging Deployment

```bash
# Deploy code
pnpm dlx vercel --target=staging

# Deploy database (if migrations exist)
cd packages/database
pnpm supabase:push

# Run smoke tests
BASE_URL=https://staging.arch-systems.com pnpm test:e2e
```

**Verify on staging**:

- [ ] Login works
- [ ] All 8 departments load
- [ ] Real-time updates work
- [ ] AI chat responds
- [ ] External tools show status

### Step 2: Production Backup

```bash
# Backup database before deploy
cd packages/database
supabase db dump --db-url "$PRODUCTION_DB_URL" -f backups/pre-deploy-$(date +%Y%m%d-%H%M).sql
```

### Step 3: Production Deploy

```bash
# Deploy during low-traffic window (avoid shift changes)

# 1. Deploy code
pnpm dlx vercel --prod

# 2. Deploy database (if needed)
cd packages/database
pnpm supabase:push

# 3. Monitor
# Watch Sentry for errors
# Check Vercel function logs
```

### Step 4: Post-Deploy Verification

```bash
# Health check
curl https://portal.arch-systems.com/api/health

# Should return: {"status":"ok","version":"1.x.x"}
```

**Manual checks**:

- [ ] Homepage loads
- [ ] Login works
- [ ] Department dashboards render
- [ ] Forms submit successfully
- [ ] No console errors

---

## Rollback (If Things Go Wrong)

### Quick Rollback (Code)

```bash
# List recent deployments
pnpm dlx vercel list

# Rollback to previous
pnpm dlx vercel --prod --target=PREVIOUS_DEPLOYMENT_ID
```

### Database Rollback (Emergency)

```bash
# Restore from backup (use with caution!)
psql "$PRODUCTION_DB_URL" < backups/pre-deploy-YYYYMMDD.sql
```

### Database Hotfix (Reverse Migration)

```sql
-- Create reverse migration
-- packages/database/migrations/XXX_reverse_bad_change.sql

-- Example: Drop a column you just added
ALTER TABLE machines DROP COLUMN IF EXISTS bad_column;

-- Then push
cd packages/database && pnpm supabase:push
```

---

## Deployment Schedule

### Recommended Windows

| Environment | Best Time         | Avoid                          |
| ----------- | ----------------- | ------------------------------ |
| Staging     | Anytime           | —                              |
| Production  | 2-4 AM local time | Shift changes (6-8 AM, 6-8 PM) |
| Hotfix      | Immediate if P1   | —                              |

### Shift Change Times (Avoid)

- Day shift start: 6:00 AM
- Day shift end: 6:00 PM
- Night shift start: 6:00 PM
- Night shift end: 6:00 AM

**Critical**: Never deploy during shift handoffs when logs are being actively updated.

---

## Common Deployment Issues

### Issue: Build Fails on Vercel

**Cause**: Often environment variables not set.

**Fix**:

```bash
# Set env vars
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL
pnpm dlx vercel env add SUPABASE_SERVICE_KEY
# ... etc

# Redeploy
pnpm dlx vercel --prod
```

### Issue: "Module not found: @repo/ui"

**Cause**: Nx build order issue.

**Fix**:

```bash
# Build packages first
pnpm --filter @repo/ui build
pnpm --filter @repo/theme build

# Or full rebuild
pnpm build
```

### Issue: Database Connection Errors

**Cause**: IP not allowlisted or connection limit.

**Fix**:

- Check Supabase Dashboard → Database → Connection Pooling
- Add Vercel IP ranges to allowlist
- Check connection count: `SELECT count(*) FROM pg_stat_activity;`

### Issue: Styles Missing in Production

**Cause**: Tailwind purge removing dynamic classes.

**Fix**:

- Ensure classes are complete strings: `className="bg-" + color` ❌
- Use full class names: `className={color === 'red' ? 'bg-red-500' : 'bg-blue-500'}` ✅

---

## Emergency Hotfix Process

For critical production issues (P1):

```bash
# 1. Create hotfix branch from production tag
git checkout -b hotfix/v1.5.2 v1.5.1

# 2. Apply minimal fix (1-2 files max)
# ... edit files ...

# 3. Test locally
pnpm build
pnpm --filter portal type-check

# 4. Deploy immediately (bypass staging for P1)
pnpm dlx vercel --prod

# 5. Merge back to main
git checkout main
git merge hotfix/v1.5.2
git push origin main
```

**After hotfix**:

- Document in incident log
- Write post-mortem
- Schedule proper fix for next sprint

---

## Monitoring Post-Deploy

### Watch These For 1 Hour After Deploy

1. **Sentry**: <https://sentry.io/organizations/arch-systems>
   - New errors spiking?
   - Error rate > 1%?

2. **Vercel Analytics**: Dashboard → Real-time
   - Function error rate
   - Response times

3. **Supabase Dashboard**: <https://supabase.com/dashboard>
   - Database connections
   - Query performance
   - Auth success rate

4. **User Reports**: #support Slack channel
   - Any complaints?
   - Issues with specific features?

---

## Quick Reference: Commands

```bash
# Full deploy pipeline
pnpm lint && pnpm type-check && pnpm test && pnpm build && pnpm dlx vercel --prod

# Just database
pnpm supabase:push

# Staging only
pnpm dlx vercel --target=staging

# Rollback
pnpm dlx vercel --prod --target=DEPLOYMENT_ID

# View logs
pnpm dlx vercel logs
```

---

---

## Method D: On-Premises Linux Server via Cockpit

The portal is designed as an **on-premises system**. The recommended production target is a Linux server at the mining site using the same Docker Compose stack as local dev.

### Step 1: Provision Server

```bash
# Minimum: Ubuntu 22.04 LTS, 8GB RAM, 4 CPU cores
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Cockpit (web-based server management on port 9090)
sudo apt install cockpit
sudo systemctl enable --now cockpit.socket
```

### Step 2: Deploy Stack

```bash
# Clone repo to server
git clone <repo-url> /opt/arch-systems
cd /opt/arch-systems

# Configure environment
cp apps/portal/.env.example apps/portal/.env
# Edit .env with production Supabase keys, AI provider keys

# Launch full stack (identical to local dev)
./scripts/deploy.sh local
```

### Step 3: Verify

```bash
docker compose ps
# portal:3000, n8n:5678, grafana:9091, prometheus:9090, redis:6379 — all Up

# Access portal
curl http://localhost:3000  # → HTML response
```

### Updating Production

```bash
# Via Cockpit terminal or SSH
cd /opt/arch-systems
git pull origin master
docker compose up -d --no-deps --build portal
```

See [[on-premises-deployment]] for full provisioning checklist, firewall rules, Cockpit setup, and offline/air-gapped update procedure.

---

## Related

- [[deployment]] — Full deployment runbook
- [[on-premises-deployment]] — On-premises server setup & Cockpit guide
- [[incident-response]] — If deploy causes issues
- [[troubleshooting]] — Common issues
- [[nx-monorepo]] — Build system
