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
  const src = dashboardId
    ? `${baseUrl}/dashboard/${dashboardId}`
    : `${baseUrl}/`;

  return (
    <div className="relative rounded-xl overflow-hidden border border-[var(--border-emphasis)]">
      {loading && (
        <div
          className="flex items-center justify-center bg-[var(--bg-primary)]"
          style={{ height }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#3ecf8e] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[var(--text-secondary)]">
              Loading SCADA…
            </p>
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

## Status

- [ ] Add FUXA to Docker Compose
- [ ] Create FuxaFrame embed component
- [ ] Wire into ScadaPanel with view toggle
- [ ] Set up data bridge (MQTT or HTTP)
- [ ] Apply theme tokens
- [ ] Deploy and test
