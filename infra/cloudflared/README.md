# Cloudflare Tunnel Configuration & Edge CDN Guide (Option A)

This directory contains the production Cloudflare Tunnel (`cloudflared`) configurations for bridging:

1. **Plantcor Mining Operations Portal (`apps/portal`)** running Next.js 16 standalone.
2. **On-Site FUXA SCADA Controller (`infra/cloudflared/fuxa-tunnel.yml`)** bridging industrial OPC-UA/Modbus hardware.

## Deployment Topology

```
                  [ End-User / Browser ]
                            │
                            ▼
         [ Cloudflare Edge CDN & Zero-Trust WAF ]
                            │
               ┌────────────┴────────────┐
               │  Outbound Encrypted     │ (Cloudflare Tunnel)
               │  Argo Tunnel            │
               ▼                         ▼
  [ Arch-Systems Portal ]     [ On-Site SCADA Server ]
    (http://localhost:3000)      (http://localhost:8088)
```

## Quick Start (Option A: Production Setup)

### 1. Ephemeral Development Testing (TryCloudflare)

To test exposing your local dev server (`http://localhost:3000`) instantly through Cloudflare without an account:

```bash
cloudflared tunnel --url http://localhost:3000
```

### 2. Validating Ingress Configuration Files

Validate your YAML configurations before running in production:

```bash
# Validate Portal + SCADA production tunnel ingress
cloudflared tunnel --config infra/cloudflared/production-tunnel.yml.example ingress validate

# Validate FUXA SCADA tunnel ingress
cloudflared tunnel --config infra/cloudflared/fuxa-tunnel.yml ingress validate
```

### 3. Running Named Production Tunnel

```bash
# Start named tunnel service
cloudflared tunnel --config infra/cloudflared/production-tunnel.yml run
```

### 4. Systemd Daemon Service Setup (`/etc/systemd/system/cloudflared.service`)

```ini
[Unit]
Description=Cloudflare Tunnel Daemon for Arch-System
After=network.target

[Service]
Type=simple
User=cloudflared
ExecStart=/usr/bin/cloudflared tunnel --config /etc/cloudflared/config.yml run
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
```
