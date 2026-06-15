# On-Premises Server Setup & Cockpit

**Priority:** CRITICAL  
**Estimated Effort:** 1–2 days  
**Status:** ✅ Code artifacts complete — awaiting physical server provisioning

> Provision and configure a Linux server at the mining site to run the full Arch-Systems stack identically to the local development environment, managed via Cockpit web UI.

---

## Overview

The portal currently runs fully in local development via `./scripts/deploy.sh local`. The production deployment target is an **on-premises Linux server** at the mining site — not a cloud provider. This is intentional for network isolation, data sovereignty, and offline resilience in remote mine environments.

The deployment script is already production-identical. Moving to production is a matter of provisioning the server, installing prerequisites, and running the same script.

---

## Current State

```
Local Dev (✅ Fully Operational)
─────────────────────────────────
Portal        → localhost:3000
AI Chat       → via portal
n8n           → localhost:5678
Grafana       → localhost:9091
Prometheus    → localhost:9090
Redis         → localhost:6379
Supabase      → localhost:54321

Production Target (⏳ Pending provisioning)
────────────────────────────────────────────
Same services, same ports, same script
Server management via Cockpit → :9090
```

---

## Prerequisites

### Server Requirements

| Component | Minimum          | Recommended               |
| --------- | ---------------- | ------------------------- |
| OS        | Ubuntu 22.04 LTS | RHEL 9 / Ubuntu 24.04 LTS |
| CPU       | 4 cores          | 8+ cores                  |
| RAM       | 8 GB             | 16–32 GB                  |
| Disk      | 100 GB SSD       | 500 GB SSD                |
| Network   | LAN only         | LAN + VPN                 |

### Software

- Docker Engine 24+
- Docker Compose v2
- Node.js ≥ 20.17.0 (via volta)
- pnpm 9.12.0
- Cockpit (web-based system monitoring)
- Git

---

## Implementation Checklist

### Phase A — Server Provisioning

- [ ] Install Ubuntu 22.04 LTS or RHEL 9
- [ ] Create `arch` user: `sudo useradd -m -s /bin/bash arch && sudo usermod -aG docker arch`
- [ ] Configure SSH key-based auth (disable password auth)
- [ ] Configure firewall (UFW / firewalld):
  - Allow: 22 (SSH), 3000 (portal), 9090 (Cockpit), 9091 (Grafana)
  - Block: all other external ports
- [ ] Create data directories: `sudo mkdir -p /opt/arch-systems/data/{n8n,flowise,redis}`

### Phase B — Cockpit Installation

```bash
# Ubuntu
sudo apt install cockpit
sudo systemctl enable --now cockpit.socket

# RHEL
sudo dnf install cockpit
sudo systemctl enable --now cockpit.socket
```

- [ ] Access Cockpit at `http://<server-ip>:9090`
- [ ] Install Cockpit Docker extension: `sudo apt install cockpit-docker` (Ubuntu)
- [ ] Add monitoring dashboard widgets (CPU, memory, disk, network)

### Phase C — Docker & Services Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone repo
git clone <repo-url> /opt/arch-systems
cd /opt/arch-systems

# Copy and configure production environment
cp apps/portal/.env.production.example apps/portal/.env
# Edit .env: fill in server IP, Supabase keys, AI keys, Redis password

# Deploy
./scripts/deploy.sh production
```

- [ ] Verify all containers start: `docker compose ps`
- [ ] Confirm portal accessible on port 3000
- [ ] Confirm Grafana on port 9091
- [ ] Confirm n8n on port 5678

### Phase D — Offline Capability

- [ ] Pre-pull all Docker images: `docker compose pull`
- [ ] Export images as tarballs for air-gapped updates:
  ```bash
  docker save <image> | gzip > <image>.tar.gz
  ```
- [ ] Test full stack bring-up with network disconnected
- [ ] Document image update procedure

### Phase E — Validation

- [ ] Run: `curl -fs http://localhost:3000` — portal responds
- [ ] Run: `curl -fs http://localhost:9091` — Grafana responds
- [ ] Verify all 8 departments load in browser
- [ ] Confirm AI chat connects to providers (or falls back correctly offline)
- [ ] Test n8n workflow triggers
- [ ] Verify Prometheus scraping all targets
- [ ] Confirm RLS policies block cross-department access

---

## Deployment Workflow

```
Developer Machine                  Production Server
─────────────────                  ─────────────────
  git push                   →       git pull
  (or manual copy)                   ./scripts/deploy.sh local
                                     docker compose up -d
                                     → All services restart
```

For quick production updates (git pull + restart without rebuilding):

```bash
./scripts/deploy.sh production --skip-build
```

Install as a systemd service for auto-start on boot:

```bash
sudo cp systemd/arch-systems.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now arch-systems
# Check status:
sudo systemctl status arch-systems
journalctl -u arch-systems -f
```

---

## Environment Variables

Critical production values to configure in `apps/portal/.env`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://<server-ip>:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>

# AI Providers
GROQ_API_KEY=<key>
OPENROUTER_API_KEY=<key>
TOGETHER_API_KEY=<key>

# Redis
REDIS_URL=redis://localhost:6379

# Monitoring
SENTRY_DSN=<dsn>
```

---

## Related Pages

- [[deployment|Deployment Runbook]] — Full deployment procedures
- [[how-to-deploy-production|Q: How do I deploy to production?]] — Step-by-step guide
- [[monitoring-error-tracking|Monitoring & Error Tracking]] — Grafana/Prometheus setup
- [[external-tools|External Tools Integration]] — n8n, Redis configuration
- [[incident-response|Incident Response Playbook]] — Production incident handling
