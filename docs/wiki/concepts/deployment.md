---
title: Deployment Runbook
created: 2026-05-15
updated: 2026-05-15
type: concept
tags: [deployment, ops, production, ci-cd]
sources: [CLAUDE.md, turbo.json]
confidence: high
---

# Deployment Runbook

Step-by-step procedures for deploying the Arch-Systems portal to production environments.

---

## Pre-Deployment Checklist

### 1. Code Quality Gates

```bash
# Run all quality checks
pnpm lint
pnpm --filter portal type-check
pnpm --filter portal test
pnpm build
```

All checks must pass before deployment.

### 2. Database Migration Review

```bash
# List pending migrations
cd 01_platform_packages/database
pnpm supabase migration list

# Review migration files
cat migrations/$(ls -t migrations/*.sql | head -1)
```

Verify:

- [ ] RLS policies added for new tables
- [ ] Indexes created for performance
- [ ] No destructive operations without backup plan

### 3. Environment Variables

Verify production `.env`:

```bash
# Required variables
cat 00_applications/portal/.env | grep -E "^NEXT_PUBLIC_SUPABASE_URL|^SUPABASE_SERVICE_KEY"
cat 00_applications/portal/.env | grep -E "^GROQ_API_KEY|^OPENROUTER_API_KEY"
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_ANON_KEY`
- `GROQ_API_KEY` (or at least one AI provider)

---

## Deployment Methods

### Method A: Vercel (Recommended for Portal)

```bash
# 1. Link to Vercel project
pnpm dlx vercel link

# 2. Set environment variables
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL
pnpm dlx vercel env add SUPABASE_SERVICE_KEY
# ... add all required env vars

# 3. Deploy
pnpm dlx vercel --prod
```

**Configuration**:

- Build Command: `cd ../.. && pnpm build`
- Output Directory: `00_applications/portal/.next`
- Install Command: `pnpm install`

### Method B: Self-Hosted (Docker)

```dockerfile
# Dockerfile (add to 00_applications/portal/)
FROM node:20-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.12.0

# Copy workspace files
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY 01_platform_packages/ ./01_platform_packages/
COPY 00_applications/portal/ ./00_applications/portal/

# Install and build
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Expose and start
EXPOSE 3000
CMD ["pnpm", "--filter", "portal", "start"]
```

Build and deploy:

```bash
docker build -t arch-systems-portal -f 00_applications/portal/docker/Dockerfile .
docker run -p 3000:3000 --env-file 00_applications/portal/.env arch-systems-portal
```

### Method C: Traditional Server (PM2)

```bash
# Build locally
pnpm build

# Copy to server
rsync -avz --exclude 'node_modules' . user@server:/var/www/arch-systems/

# On server
ssh user@server "cd /var/www/arch-systems && pnpm install --prod && pm2 restart portal"
```

---

## Database Deployment

### Production Migration Strategy

```bash
# 1. Backup production database
supabase db dump --db-url "$PRODUCTION_DB_URL" -f backups/pre-deploy-$(date +%Y%m%d).sql

# 2. Review migrations
cd 01_platform_packages/database
pnpm supabase migration list

# 3. Deploy migrations
pnpm supabase:push

# 4. Verify in Supabase Studio
# Check: Tables, RLS policies, functions
```

### Rollback Procedure

If migration fails:

```bash
# Restore from backup (emergency only)
psql "$PRODUCTION_DB_URL" < backups/pre-deploy-YYYYMMDD.sql

# Or apply reverse migration manually
cat migrations/XXX_reverse.sql | psql "$PRODUCTION_DB_URL"
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check portal is responding
curl -s https://your-portal.com/api/health | jq .

# Expected: {"status":"ok","version":"1.5.1"}

# Check Supabase connection
curl -s https://your-portal.com/api/ai/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}' | jq .
```

### 2. Smoke Tests

Verify critical paths:

- [ ] Login page loads
- [ ] Authentication flow works
- [ ] Department list displays
- [ ] Control room dashboard loads
- [ ] Machine operations form submits
- [ ] AI chat responds
- [ ] External tools show status

### 3. Error Monitoring

Check Sentry for new errors:

```bash
# Via Sentry dashboard
# Filter: release:"1.5.1", environment:"production"
```

---

## Staging Deployment

Always deploy to staging first:

```bash
# 1. Set staging environment
export NODE_ENV=staging

# 2. Deploy to staging
pnpm dlx vercel --target=staging

# 3. Run E2E tests against staging
BASE_URL=https://staging.arch-systems.com pnpm test:e2e

# 4. Manual QA checklist
# [ ] All 8 departments accessible
# [ ] Real-time updates work
# [ ] AI chat responds with all providers
```

---

## Rollback Procedure

### Quick Rollback (Vercel)

```bash
# Promote previous deployment
pnpm dlx vercel --prod --target=PREVIOUS_DEPLOYMENT_ID
```

### Database Rollback

See Database Deployment section above.

### Emergency Hotfix

For critical production issues:

```bash
# 1. Create hotfix branch from production tag
git checkout -b hotfix/v1.5.2 v1.5.1

# 2. Apply minimal fix
# ... edit files ...

# 3. Deploy hotfix (skip staging for critical issues)
pnpm dlx vercel --prod

# 4. Merge back to main
git checkout main
git merge hotfix/v1.5.2
```

---

## Continuous Deployment (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9.12.0

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install

      - run: pnpm lint
      - run: pnpm --filter portal type-check
      - run: pnpm --filter portal test

      - name: Deploy to Vercel
        run: pnpm dlx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## Environment-Specific Notes

### Development

- Use `pnpm dev` (port 3000)
- Supabase local via `pnpm supabase:dev`
- Hot reload enabled
- Debug logging on

### Staging

- Mirrors production configuration
- Use staging Supabase project
- Test data seeded
- Sentry environment: "staging"

### Production

- Optimized builds (`next build`)
- Error tracking via Sentry
- Analytics enabled
- CDN assets cached
- Database: Production Supabase

---

## Troubleshooting Deployments

| Issue               | Solution                                     |
| ------------------- | -------------------------------------------- |
| Build fails         | Check `pnpm build` locally first             |
| Env vars missing    | Verify in Vercel dashboard or server env     |
| DB connection fails | Check IP allowlist in Supabase               |
| 500 errors          | Check Vercel logs or Sentry                  |
| Static files 404    | Verify `next.config.js` output: 'standalone' |

---

---

## Method D: On-Premises Server (Cockpit)

The primary production target is an **on-premises Linux server** at the mining site, managed via Cockpit web UI (port 9090). The local dev script is already production-identical — deployment is `git pull` + script re-run.

### Quick Deploy to On-Premises Server

```bash
# On the server (via Cockpit terminal or SSH)
cd /opt/arch-systems
git pull origin master

# Restart services (zero-downtime portal restart)
docker compose up -d --no-deps --build portal

# Full stack restart (if Docker Compose changed)
./03_operations_automation/deploy.sh local
```

### Verify All Services Running

```bash
docker compose ps
# Expected: portal, supabase, n8n, redis, prometheus, grafana — all "Up"
```

### Offline / Air-Gapped Update

```bash
# On dev machine: export images
docker save arch-portal:latest | gzip > arch-portal.tar.gz
scp arch-portal.tar.gz user@mining-server:/opt/arch-systems/

# On server: load and restart
docker load < arch-portal.tar.gz
docker compose up -d --no-deps portal
```

See [[on-premises-deployment]] for full provisioning checklist, Cockpit setup, and environment variable reference.

---

## Related

- [[troubleshooting]] — General development issues
- [[supabase-local-dev]] — Database setup
- [[nx-monorepo]] — Build system
- [[monitoring-error-tracking]] — Sentry and observability
- [[on-premises-deployment]] — Full on-premises server setup & Cockpit guide
