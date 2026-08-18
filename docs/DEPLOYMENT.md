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

### Self-Hosted Production Setup (with Cloud Supabase)

In a self-hosted architecture, Next.js 16 (`apps/portal`) and background services run on your dedicated Linux host (Ubuntu, Arch, Rocky/RHEL) while Supabase serves as the managed cloud backend (Database, Auth, Storage, Realtime).

#### 1. Environment Configuration

Create a dedicated production environment file on the server:

```bash
cp apps/portal/env/.env.production.example .env.production
chmod 600 .env.production
```

Key environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Managed Supabase project URL (`https://<project-ref>.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon/public API key
- `SUPABASE_SERVICE_KEY`: Supabase service role secret (server-side only)
- `DATABASE_URL` / `DATABASE_POOLER_URL`: PostgreSQL connection string (Transaction pooler on port 6543 / 5432)
- `REDIS_URL`: Redis caching and rate-limiting instance
- `NODE_ENV`: `production`
- `PORT`: `3000`

#### 2. Standalone Build & Asset Sync Workflow

Next.js 16 is configured with `output: 'standalone'` in `apps/portal/next.config.mjs`. This generates a self-contained Node.js server artifact containing only required `node_modules` dependencies at `apps/portal/.next/standalone`.

```bash
# 1. Install dependencies with lockfile integrity
pnpm install --frozen-lockfile

# 2. Build portal package with standalone output
pnpm --filter portal build

# 3. Sync static and public assets into standalone bundle
cp -r apps/portal/public apps/portal/.next/standalone/apps/portal/public
cp -r apps/portal/.next/static apps/portal/.next/standalone/apps/portal/.next/static
```

#### 3. Pre-Flight Verification

Validate your production environment and build integrity before starting the service:

```bash
./scripts/verify-prod-env.sh .env.production
```

This automates:

- Validation of Supabase URL, anon key, and service role key.
- Node.js runtime version check (`>= 20`).
- Verification of standalone entrypoint (`server.js`) and synced static assets (`.next/static`, `public/`).

#### 4. Production Systemd Service Unit

Create `/etc/systemd/system/arch-system.service`:

```ini
[Unit]
Description=Arch-Systems Portal (Next.js 16 Standalone Production)
After=network.target remote-fs.target
Documentation=https://github.com/Timothy191/Arch-System

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/var/www/arch-system
ExecStart=/usr/bin/node /var/www/arch-system/apps/portal/.next/standalone/apps/portal/server.js
Restart=always
RestartSec=5s
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/var/www/arch-system/.env.production
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
SyslogIdentifier=arch-system

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable arch-system
sudo systemctl start arch-system
sudo systemctl status arch-system
```

#### 5. Nginx Reverse Proxy & SSL

Create `/etc/nginx/sites-available/arch-system`:

```nginx
server {
    listen 80;
    server_name portal.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/portal.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.yourcompany.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Static asset caching
    location /_next/static/ {
        alias /var/www/arch-system/apps/portal/.next/static/;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /public/ {
        alias /var/www/arch-system/apps/portal/public/;
        expires 30d;
        access_log off;
    }

    # Proxy to standalone Next.js server
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

Enable and reload Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/arch-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. Automated Deploy Script

For routine production releases:

```bash
# Interactive deployment
./scripts/deploy.sh production

# Non-interactive (CI/CD)
./scripts/deploy.sh production --force

# Rollback to previous deployment if needed
./scripts/deploy.sh production --rollback
```

### Production Safety Features

1. **Automatic Backup**: Creates rollback point before deployment
2. **Health Checks**: Verifies all services before marking complete (`curl http://127.0.0.1:3000/api/health`)
3. **Rollback**: One-command rollback if issues detected (`./scripts/deploy.sh production --rollback`)

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
docker build -t arch-systems:latest -f apps/portal/docker/Dockerfile .
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
