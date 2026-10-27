# FUXA SCADA Troubleshooting Guide (`TASK-9.2`)

**Audience:** Control Room Operators, SCADA Engineers, Platform On-Call  
**Components:** `FuxaFrame.tsx`, `ScadaPanel.tsx`, `/api/health/fuxa`, `/api/control-room/scada-status`

---

## 1. FUXA SCADA Architecture in Arch-System

Arch-System integrates with the **FUXA** web-based SCADA/HMI platform to render live plant process diagrams, crusher telemetry, and fleet sensor feeds inside the Control Room workspace:

1. **Presentation Layer (`FuxaFrame.tsx` & `ScadaPanel.tsx`):**
   - `FuxaFrame` embeds the FUXA HMI server (`NEXT_PUBLIC_FUXA_URL`) inside a sandboxed iframe while polling health and maintaining a cached telemetry snapshot.
   - `ScadaPanel` displays structured machine telemetry cards hydrated via initial Server Component fetch and updated via Supabase Realtime subscriptions.
2. **Health & Status Probes:**
   - `GET /api/health/fuxa`: Server-side probe verifying HTTP reachability, response latency, CORS headers, and iframe embedding headers (`X-Frame-Options` / `Content-Security-Policy`) against `NEXT_PUBLIC_FUXA_URL`.
   - `GET /api/control-room/scada-status`: Control Room status endpoint reporting live connection state (`online`, `degraded`, `offline`) and last-seen telemetry timestamps.
   - `GET /api/health`: Unified health aggregator combining FUXA, Redis (`/api/health/redis`), and Supabase Realtime (`/api/health/supabase-realtime`) health checks.
3. **Resilience & Cache Layer:**
   - Latest valid machine telemetry is cached in Redis (and browser fallback storage) so operators retain visibility during OT network blips.

---

## 2. Degraded Mode & Cache Fallback Behavior

When the FUXA server or OT network becomes slow or unreachable, the UI automatically transitions into **Degraded Mode** rather than crashing:

- **`FuxaFrame` Behavior:**
  - Detects probe failures, iframe load timeouts, or non-200 status from `/api/health/fuxa`.
  - Switches from the live iframe view to the **Cached Telemetry Snapshot** view with an amber `DEGRADED — CACHED DATA` banner showing the snapshot age.
  - Schedules automatic background exponential-backoff retries (`Retry Now` button also available for manual re-probing).
- **`ScadaPanel` Behavior:**
  - If Supabase Realtime or SCADA polling drops, `ScadaPanel` preserves the last known machine telemetry state in memory/cache, marks the feed badge as `Degraded` / `Offline`, and emits an OpenTelemetry span error event for observability.

---

## 3. Common Failure Modes & Diagnosis

| Symptom                                                       | Root Cause                                                                                 | Diagnostic Check                                                                                               |
| :------------------------------------------------------------ | :----------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **Blank Iframe / "Refused to connect"**                       | `X-Frame-Options: DENY` or `SAMEORIGIN` on FUXA reverse proxy, or CSP `frame-src` mismatch | Run `curl -I $NEXT_PUBLIC_FUXA_URL` and inspect `X-Frame-Options` & `Content-Security-Policy: frame-ancestors` |
| **CORS Error on Health Probe**                                | Missing `Access-Control-Allow-Origin` on FUXA API endpoints                                | Check `GET /api/health/fuxa` JSON response field `corsAllowed`                                                 |
| **WebSocket Drop / Frozen Values**                            | OT firewall/proxy terminating idle WebSocket (`ws://`/`wss://`) connections                | Inspect browser DevTools Network → WS tab for `1006 Abnormal Closure`                                          |
| **Stale Telemetry (`>60s` old)**                              | PLC/OPC-UA bridge disconnected from FUXA backend, or Redis cache serving expired fallback  | Check `/api/control-room/scada-status` `lastUpdated` timestamp and FUXA DAQ logs                               |
| **`NEXT_PUBLIC_FUXA_URL` Points to `localhost:1881` in Prod** | Misconfigured environment variable in deployment                                           | Verify production `.env` / Vercel environment configuration                                                    |

---

## 4. Step-by-Step Remediation Procedures

### Procedure A: Verify Health Endpoints First

Run the unified and FUXA-specific health probes to isolate whether the issue is browser-specific or server-wide:

```bash
curl -s http://localhost:3000/api/health/fuxa | jq .
curl -s http://localhost:3000/api/health | jq .
```

- If `status === "healthy"` on the server but the operator's browser shows `Offline`, the operator's workstation cannot reach the FUXA host directly (check workstation VLAN/VPN routing and browser extensions).

### Procedure B: Fix Iframe Embedding (`X-Frame-Options` / CSP)

1. Ensure the FUXA reverse proxy (Nginx / Cloudflare Tunnel) allows framing from the Portal origin:
   ```nginx
   proxy_hide_header X-Frame-Options;
   add_header Content-Security-Policy "frame-ancestors 'self' https://portal.<domain>;";
   ```
2. Ensure `apps/portal/proxy.ts` CSP `frame-src` includes the configured `NEXT_PUBLIC_FUXA_URL` origin.

### Procedure C: Recover from WebSocket Drops & Stale Telemetry

1. In the Control Room UI, click **Retry Connection** on `FuxaFrame` or toggle the view mode in `ScadaPanel` to force a fresh probe and subscription handshake.
2. Check Supabase Realtime health via `GET /api/health/supabase-realtime`.
3. If the FUXA container is unresponsive on the OT cluster:
   ```bash
   kubectl logs deploy/fuxa -n scada --tail=100
   kubectl rollout restart deploy/fuxa -n scada
   ```
4. While FUXA restarts, operators should continue logging hourly loads and machine status updates using radio check-ins; all writes are buffered and persisted directly to PostgreSQL.

---

## 5. Escalation Matrix

- **Level 1 (0–15 min):** Control Room Operator switches to `ScadaPanel` tabular fallback and verifies radio telemetry with field units.
- **Level 2 (15–30 min):** On-Call Platform Engineer checks `/api/health/fuxa`, `/api/health/redis`, and `/api/health/supabase-realtime`.
- **Level 3 (>30 min):** OT Networking & SCADA Engineering Team investigates PLC/OPC-UA gateway and OT VLAN partition (see `docs/runbooks/control-room/scada-offline.md`).
