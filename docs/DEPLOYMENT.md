# Arch-Systems Deployment Guide

Unified deployment system for local development, staging, and production environments.

## Related Documentation

- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** — Complete documentation index and quick navigation guide
- **[CLAUDE.md](CLAUDE.md)** — Technical guide and development commands
- **[AGENTS.md](AGENTS.md)** — Quality gates and verification steps
- **[SECURITY.md](SECURITY.md)** — Security policy and best practices

---

## Quick Start

```bash
# Local development (full stack)
./scripts/deploy.sh local

# Staging deployment
./scripts/deploy.sh staging

# Production deployment
./scripts/deploy.sh production
```

---

## Deployment Script

The unified `deploy.sh` script handles all deployment scenarios with intelligent defaults and comprehensive error handling.

### Features

- **🔄 Unified Interface**: Single script for all environments
- **🛡️ Safety First**: Pre-flight checks, backups, rollbacks
- **📊 Progress Tracking**: Real-time logging with colorized output
- **🔒 Lock Protection**: Prevents concurrent deployments
- **🧪 Dry-Run Mode**: Preview changes without executing
- **📱 Notifications**: Webhook integration for deployment events

### Usage

```bash
./scripts/deploy.sh [MODE] [OPTIONS]

Modes:
  local       Full stack with local Supabase (development)
  staging     Production-like staging environment
  production  Production deployment (external Supabase)

Options:
  --skip-build     Skip build phase
  --skip-tests     Skip test execution
  --clean          Stop and clean all services
  --dry-run        Preview changes without executing
  --migrate-only   Only run database migrations
  --rollback       Rollback to previous deployment
  --force          Skip confirmation prompts
```

---

## Local Development

### Start Full Stack

```bash
./scripts/deploy.sh local
```

This starts:

- Next.js portal on <http://localhost:3000>
- Local Supabase on <http://localhost:54321>
- Redis, n8n, Flowise (via Docker)
- Prometheus & Grafana monitoring

### Clean Restart

```bash
./scripts/deploy.sh local --clean
```

Stops all services and performs a fresh start.

### Development with Existing Database

```bash
# Skip database initialization if already running
./scripts/deploy.sh local
```

The script detects running Supabase and reuses it.

---

## Local Network / Wi-Fi Hosting (Live Local)

To run this machine as a local server so that other devices (such as employee phones or tablets) connected to the same Wi-Fi/LAN can access the portal:

```bash
./scripts/deploy-live-local.sh
```

### Key Mechanics

- **Dynamic IP Resolution**: Automatically resolves the primary network interface IP address (e.g., `192.168.1.15`).
- **Client Configuration Exposure**: Modifies `.env` temporarily to bind client-side services (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_FUXA_URL`) to the host IP instead of loopback.
- **Port Exposure**: Compiles the Next.js production build and exposes the portal web server on all interfaces (`0.0.0.0:3000`).
- **Auto-Restore**: Halting the server using `./scripts/shutdown.sh` will automatically restore your original local development `.env` configuration.

---

## Staging Deployment

### Prerequisites

1. Create `.env.staging` in `apps/portal/`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

2. Deploy:

```bash
./scripts/deploy.sh staging
```

### GitHub Actions (Staging)

Staging auto-deploys on every push to `main`:

```yaml
# .github/workflows/deploy.yml
# Already configured - see file for details
```

---

## Production Deployment

### Automated Setup Script

For first-time production setup, use the automated script:

```bash
./scripts/setup-production-environment.sh
```

**Options**:

- `--no-systemd` — Skip systemd service setup
- `--no-docker-tools` — Skip Docker tools stack (n8n, Flowise, Langfuse, Qdrant, ClickHouse)
- `--no-monitoring` — Skip monitoring stack (Prometheus, Grafana, cAdvisor)
- `--force` — Force overwrite existing configuration
- `--dry-run` — Preview changes without executing

The script automates:

1. Prerequisites check (Node.js ≥22, pnpm 9.15.9, Docker)
2. Environment configuration from `.env.production.example`
3. Systemd service setup (optional)
4. Essential services (Supabase, Redis)
5. Docker tools stack (optional)
6. Monitoring stack (optional)
7. Portal build and startup
8. Health check

**Platform Support**: The script includes automatic OS detection and Rocky Linux/RHEL-specific guidance. See [Rocky Linux Compatibility Guide](scripts/ROCKY_LINUX_COMPATIBILITY.md) for platform-specific setup instructions.

### Manual Setup

#### Prerequisites

1. **Production Environment File**:

```bash
cp apps/portal/.env.production.example apps/portal/.env
# Fill in all required variables
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL` (non-localhost)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `GROQ_API_KEY` (or other AI provider)

2. **Systemd Service** (optional but recommended):

```bash
sudo cp scripts/arch-systems.service /etc/systemd/system/
sudo systemctl enable arch-systems
```

### Deploy to Production

```bash
# Interactive (with confirmation)
./scripts/deploy.sh production

# Non-interactive (CI/CD)
./scripts/deploy.sh production --force

# Skip build if already built
./scripts/deploy.sh production --skip-build
```

### Production Safety Features

1. **Automatic Backup**: Creates rollback point before deployment
2. **Health Checks**: Verifies all services before marking complete
3. **Rollback**: One-command rollback if issues detected

```bash
# Rollback to previous deployment
./scripts/deploy.sh production --rollback
```

---

## Database Migrations

### Migration-Only Deployment

```bash
# Run only migrations without full deploy
./scripts/deploy.sh production --migrate-only
```

### Migration Safety

1. **Backup Before Migrations**: Always backups production DB first
2. **Review Migrations**: Script lists pending migrations before applying
3. **Rollback Plan**: Keeps previous state for emergency rollback

### Manual Migration (if needed)

```bash
cd packages/database
pnpm supabase migration list    # See pending
pnpm supabase db push           # Apply to remote
```

---

## Docker Deployment

### Build Production Image

```bash
docker build -t arch-systems:latest -f apps/portal/Dockerfile .
```

### Docker Compose (Production)

```bash
# Start with production overrides
docker compose -f docker-compose.tools.yml -f docker-compose.production.yml up -d
```

Services included:

- **portal**: Next.js application
- **n8n**: Workflow automation
- **flowise**: AI workflow builder
- **redis**: Caching & session store
- **prometheus**: Metrics collection
- **grafana**: Visualization dashboards

---

## CI/CD with GitHub Actions

### Workflows

| Workflow     | Trigger            | Purpose                          |
| ------------ | ------------------ | -------------------------------- |
| `ci.yml`     | PR + Push to main  | Quality gates, tests, Lighthouse |
| `deploy.yml` | Push to main, tags | Deploy to staging/production     |

### Secrets Required

For GitHub Actions deployment:

```bash
# Required secrets
github secrets set VERCEL_TOKEN
github secrets set VERCEL_ORG_ID
github secrets set VERCEL_PROJECT_ID

# For SSH deployment
github secrets set DEPLOY_HOST
github secrets set DEPLOY_USER
github secrets set DEPLOY_KEY

# For notifications (optional)
github secrets set DEPLOY_WEBHOOK_URL
```

### Deployment Targets

Set repository variables to configure target:

```bash
github variables set DEPLOY_TARGET vercel  # or 'ssh', 'docker'
github variables set STAGING_URL https://staging.plantcor.os
github variables set PRODUCTION_URL https://plantcor.os
```

---

## Troubleshooting

### Deployment Failed

```bash
# Check logs
tail -f deploy-*.log

# Common fixes
./scripts/deploy.sh local --clean    # Full reset
pnpm install                         # Fix dependencies
rm -rf apps/portal/.next             # Clear build cache
```

### Database Connection Issues

```bash
# Check Supabase status
pnpx supabase status

# Restart local Supabase
pnpx supabase stop
pnpx supabase start

# Verify environment variables
grep SUPABASE apps/portal/.env
```

### Rollback Emergency

```bash
# Immediate rollback
./scripts/deploy.sh production --rollback

# Or manually restore backup
# (Backups stored in .deploy-backups/)
```

---

## Environment Comparison

| Feature        | Local        | Staging           | Production          |
| -------------- | ------------ | ----------------- | ------------------- |
| Supabase       | Local Docker | Staging project   | Production project  |
| Hot Reload     | ✅ Yes       | ❌ No             | ❌ No               |
| Error Tracking | Console      | Sentry            | Sentry              |
| Analytics      | Disabled     | Test mode         | Full                |
| SSL            | ❌           | ✅                | ✅                  |
| CDN            | ❌           | Vercel/Cloudflare | Vercel/Cloudflare   |
| Monitoring     | Grafana      | Grafana           | Grafana + PagerDuty |

---

## Scripts Reference

| Script        | Purpose                                          |
| ------------- | ------------------------------------------------ |
| `dev.sh`      | Primary lightning local development (hot-reload) |
| `deploy.sh`   | Unified deployment (local, staging, production)  |
| `shutdown.sh` | Graceful lossless stack shutdown                 |

---

## Best Practices

1. **Always use staging first**: Deploy to staging, verify, then production
2. **Database migrations**: Review SQL before applying to production
3. **Monitor deployments**: Watch logs and error tracking after deploy
4. **Keep backups**: Automatic, but verify backup integrity periodically
5. **Use `--dry-run`**: Preview changes on new deployment targets

---

## Support

- Deployment logs: `deploy-YYYYMMDD-HHMMSS.log`
- Portal logs: `portal.log`
- Health check: `curl http://localhost:3000/api/health`
