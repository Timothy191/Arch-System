# Arch-Scripts Directory

This directory contains essential deployment, development, and maintenance scripts for the Arch-Systems project.

## 🚀 Quick Start

```bash
# Development
./dev.sh                    # Start full development environment
pnpm dev                    # Quick portal development only

# Deployment
./deploy.sh [mode]           # Deploy to local/staging/production
./deploy-live-local.sh       # Live network deployment for LAN access
./setup-production-environment.sh  # Full production setup

# Utilities
./shutdown.sh                # Graceful shutdown of all services
./preflight-checklist.sh     # Validate environment before deployment
./monitor-hud.sh            # Terminal monitoring dashboard
```

## 🏗️ Build System

This project uses **Nx** (not turborepo) for monorepo task orchestration:

- **Nx config**: `nx.json` in project root
- **Cache location**: `.nx/cache` (cleaned by scripts)
- **Task orchestration**: All package tasks run via `nx run-many`
- **Version**: 22.7.5

See `CLAUDE.md` for full Nx configuration details.

## 📋 Available Scripts

### Development

#### `dev.sh` ⭐ **Primary Development Script**

**Purpose**: Comprehensive development environment bootstrap

**Features**:

- Starts Docker and Supabase local
- Caches cleanup and port conflict resolution
- Next.js HMR with health checks
- Optional CMS and Overview apps support
- Automatic browser launch to login page
- Built-in status terminal monitoring

**Usage**:

```bash
./dev.sh                    # Standard development mode
./dev.sh --quick|-q          # Skip Docker/Supabase, start portal only
./dev.sh --force|-f          # Force kill port conflicts
./dev.sh --tools|-t          # Start Docker tools (Redis, n8n, Flowise)
./dev.sh --cms               # Start CMS on :3001
./dev.sh --overview         # Start Overview on :3002
./dev.sh --all               # Start all apps (portal, cms, overview)
```

**Requirements**:

- Node.js >= 22.0.0
- pnpm 9.15.9
- Docker (for Supabase)
- Valid `apps/portal/.env` file

---

### Deployment

#### `deploy.sh` ⭐ **Primary Deployment Script**

**Purpose**: Sequential stable deployment for all environments

**Features**:

- Three deployment modes: local, staging, production
- Sequential phase execution with health checks
- Automatic migration application
- Service dependency verification
- Kitty terminal monitoring support
- Auto-browser launch when ready

**Usage**:

```bash
./deploy.sh local             # Full local development deployment
./deploy.sh staging           # Staging environment deployment
./deploy.sh production        # Production deployment
./deploy.sh local --skip-build      # Skip build step
./deploy.sh local --skip-tests      # Skip test execution
./deploy.sh local --dry-run         # Preview changes
```

**Modes**:

- **local**: Full stack with local Supabase (development)
- **staging**: Production-like on staging environment
- **production**: Production deployment (external Supabase)

---

#### `deploy-live-local.sh` 🌐 **Network Deployment**

**Purpose**: Turn local machine into LAN-accessible server

**Features**:

- Automatic LAN IP detection
- Network reachability configuration
- Environment backup/restore
- Firewall configuration guidance
- Multi-terminal deployment monitoring

**Usage**:

```bash
./deploy-live-local.sh       # Deploy on local network
```

**Requirements**:

- Connected to Wi-Fi or LAN
- Valid network IP address
- Updated Supabase URL configuration

---

#### `setup-production-environment.sh` 🏭 **Production Setup**

**Purpose**: Automated production environment configuration

**Features**:

- systemd service setup
- Environment configuration automation
- Background process management
- Docker tools stack (n8n, Flowise, Langfuse, Qdrant)
- Monitoring stack (Prometheus, Grafana, cAdvisor)
- Health checks and monitoring
- OS detection (Rocky Linux, RHEL, CentOS)

**Usage**:

```bash
./setup-production-environment.sh                 # Full setup
./setup-production-environment.sh --no-systemd    # Skip systemd
./setup-production-environment.sh --no-docker-tools  # Skip tools
./setup-production-environment.sh --no-monitoring      # Skip monitoring
./setup-production-environment.sh --dry-run      # Preview changes
```

**Components**:

- **Essential**: Next.js server, Supabase, Redis
- **Recommended**: Docker tools stack
- **Optional**: Monitoring stack

---

### Utilities

#### `shutdown.sh` 🔌 **Graceful Shutdown**

**Purpose**: Safe shutdown of all services without data loss

**Features**:

- SIGTERM for Next.js connection pool drainage
- Non-destructive container halting
- Complete CPU/RAM relief for stack tools
- Environment configuration restoration
- Database volume preservation

**Usage**:

```bash
./shutdown.sh                # Graceful shutdown
```

**Guarantees**:

1. Graceful signal drainage prevents DB transaction corruption
2. Non-destructive container halting preserves postgres data
3. Complete CPU/RAM relief for all stack tools

---

#### `preflight-checklist.sh` ✅ **Environment Validation**

**Purpose**: Validate environment before deployment

**Features**:

- Environment checks (Node.js, pnpm, Docker)
- Repository structure validation
- Environment file verification
- Idempotent fixes with `--fix` flag
- Comprehensive error reporting

**Usage**:

```bash
./preflight-checklist.sh                     # Check only
./preflight-checklist.sh --fix              # Fix issues
```

**Checks**:

- Node.js >= 22.0.0
- pnpm 9.15.9
- Docker daemon
- Git repository
- Environment files
- Dependencies installed

---

#### `monitor-hud.sh` 📊 **Monitoring Dashboard**

**Purpose**: Terminal-based system monitoring

**Features**:

- API health and connection latency
- Next.js portal resource profiling
- Docker container resource matrix
- Live log streaming panel
- Zero terminal flicker rendering

**Usage**:

```bash
./monitor-hud.sh            # Start monitoring dashboard
```

**Monitors**:

- Next.js Portal API
- Supabase API
- Redis
- n8n (if running)
- Flowise (if running)
- Docker containers

---

#### `pentest.sh` 🔒 **Security Scanning**

**Purpose**: OWASP ZAP security baseline scan

**Features**:

- Passive baseline scanning (safe for production)
- Full active scan (development only)
- HTML and JSON report generation
- Docker-based ZAP container

**Usage**:

```bash
./pentest.sh                    # Baseline scan of localhost:3000
./pentest.sh http://myserver    # Scan custom target
./pentest.sh --full             # Full active scan (development only)
```

**Reports**:

- `test-results/pentest/zap-report-*.html`
- `test-results/pentest/zap-report-*.json`

**Requirements**:

- Docker must be running
- Target must be accessible

---

#### `ensure_reachability.py` 🌐 **Network Configuration**

**Purpose**: Configure network reachability for LAN access

**Features**:

- Automatic LAN IP detection
- Environment file updates
- Supabase configuration updates
- Backup creation before changes
- Multi-file update support

**Usage**:

```bash
./ensure_reachability.py                  # Auto-detect IP
./ensure_reachability.py 192.168.1.100   # Use specific IP
./ensure_reachability.py 192.168.1.100 <anon_key> <service_key>  # Update keys too
```

**Files Modified**:

- `.env` (root)
- `apps/portal/.env`
- `packages/supabase/config.toml`

---

#### `generate-db-docs.sh` 📚 **Database Documentation**

**Purpose**: Generate database ER diagrams and documentation

**Features**:

- Uses tbls (PostgreSQL documentation tool)
- Generates visual ER diagrams
- Creates markdown documentation
- Auto-generated TypeScript types

**Usage**:

```bash
./generate-db-docs.sh        # Generate documentation
```

**Requirements**:

- `tbls` CLI tool installed
- Database connection (local: `postgres://postgres:postgres@127.0.0.1:54322/postgres`)

**Install tbls**:

```bash
go install github.com/k1LoW/tbls/cmd/tbls@latest
```

**Output**: `docs/database/`

---

## 🔧 Environment Variables

### Required for Development

```bash
# Supabase Local (default)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key from supabase start>
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<key from supabase start>
SUPABASE_SERVICE_KEY=<key from supabase start>
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres

# Optional Services
REDIS_URL=redis://localhost:6379
N8N_URL=http://localhost:5678
FLOWISE_URL=http://localhost:3001
OLLAMA_URL=http://localhost:11434
```

### Production Requirements

```bash
# Production Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=<production service key>
DATABASE_URL=<production database URL>

# Observability
SENTRY_DSN=<your Sentry DSN>
SENTRY_AUTH_TOKEN=<your Sentry auth token>
```

## 🎯 Common Workflows

### First-Time Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment
cp apps/portal/.env.example apps/portal/.env

# 3. Validate environment
./preflight-checklist.sh --fix

# 4. Start development
./dev.sh
```

### Daily Development

```bash
# Quick development start
./dev.sh --quick

# Full development environment
./dev.sh

# Start with additional tools
./dev.sh --tools --cms
```

### Deployment Workflow

```bash
# 1. Pre-flight validation
./preflight-checklist.sh

# 2. Run quality gates
pnpm quality

# 3. Deploy
./deploy.sh production

# 4. Monitor
./monitor-hud.sh
```

### Network Deployment

```bash
# 1. Configure network reachability
./ensure_reachability.py

# 2. Deploy for LAN access
./deploy-live-local.sh

# 3. Monitor
./monitor-hud.sh
```

### Production Setup

```bash
# 1. Manual prerequisites (Node.js, pnpm, Docker)
# 2. Run production setup
./setup-production-environment.sh

# 3. Configure environment
# Edit apps/portal/.env with production values

# 4. Start services
sudo systemctl start arch-portal
```

## 🛠️ Troubleshooting

### Port Conflicts

```bash
# Force kill port conflicts
./dev.sh --force

# Manual port check
lsof -i :3000
```

### Docker Issues

```bash
# Restart Docker
sudo systemctl restart docker

# Check Docker status
docker ps
```

### Supabase Issues

```bash
# Reset local Supabase
pnpm --filter @repo/database supabase:reset

# Check Supabase status
cd packages/database && pnpx supabase status
```

### Environment Issues

```bash
# Validate environment
./preflight-checklist.sh --fix

# Regenerate types after migration
pnpm --filter @repo/database supabase:gen
```

## 💾 Database Backup & Restore

Automated PostgreSQL/Supabase backup and restore scripts.

### `backup-db.sh` 🗄️ **Database Backup**

**Purpose**: Dump the database schema and data into compressed SQL files.

**Features**:

- Schema-only and data-only dumps (separate files)
- Data dump excludes migration tracking tables (`schema_migrations`, `supabase_migrations`)
- Automatic compression with gzip
- Metadata manifest file with backup info, sizes, and `pg_dump` version
- Automatic `DATABASE_URL` resolution from env vars or `.env` files
- Fallback construction from `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`

**Usage**:

```bash
./scripts/backup-db.sh                                # Run a backup now
DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/backup-db.sh  # Override connection
```

**Output in `scripts/backups/`**:

```
backup-schema-2026-06-16_143022.sql.gz     # Schema only (no data)
backup-data-2026-06-16_143022.sql.gz       # Data only (no migrations)
backup-2026-06-16_143022.manifest.txt      # Metadata manifest
```

**Daily cron example** (add to crontab):

```bash
# Daily at 3 AM — keep 7 days of backups
0 3 * * * cd /path/to/arch-system && ./scripts/backup-db.sh
```

---

### `restore-db.sh` ⚠️ **Database Restore**

**Purpose**: Restore the database from a previous backup.

**⚠️ DESTRUCTIVE** — drops all existing tables before restoring.

**Features**:

- Accepts a backup timestamp (full or partial prefix)
- Lists available backups on no argument
- Validates database connectivity before confirmation
- Drops all public schema objects cleanly before restore
- Restores schema first, then data
- Refuses to run non-interactively unless `FORCE_RESTORE=true`

**Usage**:

```bash
# List available backups
./scripts/restore-db.sh

# Restore a specific backup
./scripts/restore-db.sh 2026-06-16_143022

# Non-interactive restore (CI/automation — use with extreme caution)
FORCE_RESTORE=true ./scripts/restore-db.sh 2026-06-16_143022
```

**Restore workflow**:

1. The script lists the backup files it found and shows the manifest
2. It verifies database connectivity
3. **You must type `yes` to confirm** the destructive operation
4. Schema (tables, types, functions) is restored first
5. Data is restored second

**Safety notes**:

- Always verify the manifest before confirming
- Test restores on a staging/development DB first
- The script does **not** create a pre-restore backup — run `backup-db.sh` before restoring if you need a rollback point
- For production, consider taking a Supabase native backup before restoring

---

## 📝 Script Maintenance

When modifying scripts:

1. Update version checks to match CLAUDE.md requirements
2. Test on all supported platforms (macOS, Linux)
3. Ensure proper error handling and exit codes
4. Document new flags or features in this README
5. Test with clean environment (no existing Docker containers)
6. **Note**: Project uses Nx (`.nx/cache`), not Turborepo (`.turbo`)

## 🗄️ Archived Scripts

The `archive/` directory contains deprecated or one-off scripts that are no longer actively used but preserved for historical reference:

- **`reorganize.mjs`** - One-off directory restructuring utility (already executed)
- **`deploy-overview.sh`** - Vague deployment script superseded by docs-generators

These scripts are kept in archive rather than deleted to preserve git history and enable restoration if needed.

**Note**: `ROCKY_LINUX_COMPATIBILITY.md` was moved to `docs/ROCKY_LINUX_COMPATIBILITY.md` as it is documentation, not an executable script.

## 🔄 Version Requirements

Current project requirements (from CLAUDE.md):

- **Node.js**: >= 22.0.0 (Volta-managed, pinned to 24.15.0)
- **pnpm**: 9.15.9 (Volta-managed)
- **Nx**: 22.7.5 (monorepo orchestration)
- **Docker**: Latest stable version
- **PostgreSQL**: 15+ (via Supabase local)

## 📚 Related Documentation

- **[CLAUDE.md](../CLAUDE.md)** - Development workflow and quality gates
- **[DESIGN.md](../DESIGN.md)** - Technical guide and architecture details
- **[DEPLOYMENT.md](../DEPLOYMENT.md)** - Deployment guide for all environments
- **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** - Complete documentation index
- **[CONTROL_ROOM_IMPLEMENTATION_TODO.md](../apps/portal/CONTROL_ROOM_IMPLEMENTATION_TODO.md)** - Control Room department implementation status
- **[DELAY_TRACKING_TEST_PLAN.md](../apps/portal/DELAY_TRACKING_TEST_PLAN.md)** - Delay tracking feature test plan

## 🚨 Safety Notes

- **Never run production deployment scripts on development machines**
- **Always backup databases before applying migrations**
- **Use `--dry-run` flag to preview changes**
- **Test deployment scripts on staging first**
- **Monitor logs during deployment**

## 🎯 Recent Feature Work

### Control Room - Delay Tracking (Jan 2026)

The Control Room department's delay tracking feature has been enhanced with:

**UX Enhancements**:

- Confirmation dialogs for commit and remove actions (prevents accidental operations)
- Toast notifications for success/error feedback (replaced alert() calls)
- In-app help section with field-specific tooltips for user guidance
- Help covers delay categories, time handling, manual override, and 12-hour limit

**Implementation Status**:

- ✅ All UX enhancements implemented in `DelayEntriesForm.tsx`
- ✅ Regression testing passed (existing CRUD unchanged)
- ✅ Comprehensive test plan created (41 test cases in `DELAY_TRACKING_TEST_PLAN.md`)
- ✅ Code passes type-check and lint
- ⏳ Manual testing pending (requires migrations 068/069 and role-based testing)

**Modified Files**:

- `apps/portal/app/(departments)/[department]/machine-operations/DelayEntriesForm.tsx`
- `apps/portal/AGENT_TRACER.md` (agent tracing updates)
- `apps/portal/DELAY_TRACKING_TEST_PLAN.md` (new test plan)

See `DELAY_TRACKING_TEST_PLAN.md` for full test coverage including:

- Regression tests, auto-calculation, manual override
- 12-hour constraint, draft/commit workflow
- Data migration, RLS filtering, UX enhancements
- Timezone handling, edge cases

---

**Last Updated**: January 27, 2026
**Script Count**: 14 active scripts
**Build System**: Nx 22.7.5 (not Turborepo)
**Removed Scripts**: 7 redundant/stale scripts removed in cleanup (2 archived, 5 previously removed)
