# FUXA SCADA Integration Plan

## Overview

[FUXA](https://github.com/frangoteam/FUXA) (4,497 stars, MIT) is a web-based SCADA/HMI
platform that can be embedded alongside the Arch-Mk2 portal. It provides drag-and-drop
dashboard creation with industrial protocol support.

## Architecture

```
Portal (Next.js :3000)           FUXA (Node.js :1881)
┌─────────────────────┐          ┌─────────────────────┐
│  ScadaPanel.tsx     │  iframe  │  FUXA Web UI        │
│  (embedded FUXA)    │ ──────→  │  ├─ Dashboard Editor│
│                     │          │  ├─ Runtime View    │
│  Supabase Realtime  │  ←──────│  └─ Alarm Console   │
│  (machine status)   │  webhook │                     │
└─────────────────────┘          │  Protocols:         │
                                 │  - Modbus TCP/RTU   │
Monorepo Package                 │  - OPC-UA           │
┌─────────────────────┐          │  - MQTT             │
│  @repo/theme        │ shared   │  - Siemens S7       │
│  (design tokens)    │ CSS vars └─────────────────────┘
└─────────────────────┘                     │
                          ┌─────────────────┴────────┐
                          │  Docker Compose Service   │
                          │  image: frangoteam/fuxa   │
                          │  ports: 1881:1881         │
                          │  volumes: ./fuxa/:/root   │
                          └──────────────────────────┘
```

## Integration Steps

### 1. Docker Compose Service

Add to `docker-compose.portal.yml` or `docker-compose.tools.yml`:

```yaml
fuxa:
  image: frangoteam/fuxa:latest
  container_name: plantcor-fuxa
  restart: unless-stopped
  ports:
    - "1881:1881"
  volumes:
    - fuxa_data:/root/.fuxa
  environment:
    - NODE_ENV=production
    - PORT=1881
  networks:
    - plantcor-tools
```

### 2. Portal Embedding

Create `apps/portal/components/control-room/FuxaFrame.tsx`:

```tsx
"use client";

import { useState } from "react";

interface FuxaFrameProps {
  dashboardId?: string;
  height?: string;
}

export function FuxaFrame({ dashboardId, height = "600px" }: FuxaFrameProps) {
  const [loading, setLoading] = useState(true);

  const baseUrl = process.env.NEXT_PUBLIC_FUXA_URL ?? "http://localhost:1881";
  const src = dashboardId ? `${baseUrl}/dashboard/${dashboardId}` : `${baseUrl}/`;

  return (
    <div className="relative rounded-xl overflow-hidden border border-[var(--border-emphasis)]">
      {loading && (
        <div className="flex items-center justify-center bg-[var(--bg-primary)]" style={{ height }}>
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#3ecf8e] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[var(--text-secondary)]">Loading SCADA…</p>
          </div>
        </div>
      )}
      <iframe
        src={src}
        className="w-full border-0"
        style={{ height }}
        onLoad={() => setLoading(false)}
        title="FUXA SCADA Dashboard"
      />
    </div>
  );
}
```

### 3. Embed in ScadaPanel.tsx

Replace or augment the existing machine list view with an iframe toggle:

```tsx
const [viewMode, setViewMode] = useState<"list" | "scada">("list");

{viewMode === "scada" && <FuxaFrame />}
{viewMode === "list" && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {machines.map(...)}
  </div>
)}
```

### 4. Data Bridge (Supabase → FUXA)

FUXA supports MQTT and HTTP APIs. Bridge Supabase Realtime changes:

- **Option A**: Use FUXA's built-in MQTT support. Run a local MQTT broker
  (Mosquitto) and have the portal publish `machine_telemetry` events to MQTT topics
  that FUXA subscribes to.

- **Option B**: Use FUXA's HTTP API for tag updates. Write a thin bridge service
  (`apps/portal/app/api/scada/bridge/route.ts`) that forwards Supabase Realtime
  changes to FUXA's REST API.

- **Option C**: Direct Postgres query. FUXA supports ODBC/Postgres connections
  to read machine data directly from the Supabase Postgres instance.

### 5. Deployment

- FUXA runs as a separate Docker container alongside the portal
- Accessible at `https://portal.example.com/scada` via reverse proxy
- Or embedded via iframe in the Control Room department tab
- The FUXA dashboard editor is admin-only; runtime view is operator-access

## Design Token Sharing

FUXA supports custom CSS themes. Map Arch-Mk2 design tokens:

```css
/* fuxa/theme.css — copy from @repo/theme */
:root {
  --fuxa-primary: #3ecf8e;
  --fuxa-bg: #1a1a2e;
  --fuxa-text: #e2e8f0;
}
```

## Reverse-Flow Ingest (Implemented 2026-08-28)

FUXA (`frangoteam/fuxa` v1.3.4) exposes **no** `/api/tag` write endpoint and **no**
`/api/health` endpoint (live-verified). It ingests external data by _pulling_ a
tag list from a **WebAPI device** (upstream issue #650 + DeepWiki). The portal
therefore uses a **reverse-flow** model:

```
Machines / Supabase webhook
  → POST /api/telemetry/push (portal)        # writes telemetry:last:<tag> in Redis
  → GET  /api/scada/tags (portal)             # FUXA WebAPI device polls this (getTags)
  → FUXA dashboard renders live tag values
```

- **System of record:** Redis keys `telemetry:last:<tag>` (24h TTL), written by
  `/api/telemetry/push` (direct + Supabase webhook) and `/api/telemetry/drilling`.
- **FUXA pull source:** `GET /api/scada/tags` returns `[{id,name,value,type}]` in
  the FUXA WebAPI device shape.
- **FUXA-side config (operator step in FUXA editor):** add a **WebAPI** device
  with `getTags` = `http://127.0.0.1:3000/api/scada/tags` (dev). Use the explicit
  IPv4 `127.0.0.1`, not `localhost` — FUXA's node resolves `localhost` to IPv6
  `::1` first, but the portal (`next dev --hostname 0.0.0.0`) is IPv4-only, so
  `localhost` gets `ECONNREFUSED`.
  The FUXA container runs with `network_mode: host` (see `compose.scada.yml`), so it
  shares the host loopback and reaches the portal directly — this sidesteps the
  host's hardened nftables firewall (`input` policy=drop, which blocks bridge
  container→host traffic). Production: point `getTags` at the portal's public URL
  via the Cloudflare tunnel (and use bridge isolation + a firewall rule, not host
  networking).
- **Health probe:** `GET /api/control-room/scada-status` HEADs the FUXA web root
  `/` (200 = healthy). The old probe of `/api/health` (404) falsely reported
  `degraded`; do not revert it.
- **Container lifecycle:** FUXA lives in `infra/docker/compose.scada.yml` (split
  from `compose.tools.yml`, `network_mode: host`, `userDir=/root/.fuxa`) and is
  brought up on every plain `pnpm dev` boot (non-quick, non-hosted).
  `userDir` points FUXA at the persistent `fuxa_data` volume so authored projects
  (`project.fuxap.db`, settings, alarms) survive container recreation (FUXA's default
  data dir is `<cwd>/_appdata`, which is ephemeral in the image). `scripts/dev.sh`
  self-heals an explicitly-stopped `plantcor-fuxa` container before the health
  check. `stop_signal: SIGINT` + `stop_grace_period: 30s` give a clean exit 0 (was 137).
- **Env:** `NEXT_PUBLIC_FUXA_URL=http://localhost:1881` (D1=a — local/tunnel
  clients only; for LAN-client iframe access use the host LAN IP or mDNS).
- **Reproducible dashboard:** `scripts/fuxa-gauge-grid.py` regenerates the FUXA view
  as a grid of radial gauges (one per telemetry tag) via the `set-view` API —
  re-run it after the telemetry tag set changes. Optional `FUXA_API_KEY` env is
  sent as `x-api-key`; `--dry-run` previews. Imports the connection first via
  `templates/fuxa-portal-connection.json`, then run this script.

## Status

- [x] Add FUXA to Docker Compose (now `infra/docker/compose.scada.yml`)
- [x] Create FuxaFrame embed component (with degraded-mode fallback + retry)
- [x] Wire into ScadaPanel with view toggle (rendered from `[department]/page.tsx`)
- [x] Set up data bridge (reverse-flow: Redis ← push, FUXA ← /api/scada/tags)
- [x] Apply theme tokens (`apps/portal/public/css/fuxa-light-theme.css`)
- [x] Self-heal + always-up dev boot + clean shutdown (P1/P2/P4)
- [x] Correct scada-status health probe (P5)
- [ ] Deploy and test (operator configures FUXA WebAPI device `getTags` URL)
