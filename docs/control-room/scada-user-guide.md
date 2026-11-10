# FUXA SCADA User Guide (`TASK-13.4`)

**Audience:** Control Room Operators, SCADA Engineers, Shift Supervisors  
**Department:** Control Room (`/control-room`)

---

## 1. Overview

The Control Room dashboard embeds the FUXA SCADA HMI (`FuxaFrame.tsx` inside `ScadaPanel.tsx`) using a reverse-flow telemetry architecture. FUXA polls `/api/scada/tags` (backed by Redis telemetry cache) and renders live equipment gauges, crusher states, and pit telemetry in light mode (`#f3f4f6`).

---

## 2. Navigating the SCADA Panel

1. **Live HMI View (`FuxaFrame`):**
   - Displays real-time machine gauges (engine RPM, hydraulic pressure, payload tonnage, fuel levels, and operational status).
   - Injects `public/css/fuxa-light-theme.css` to enforce high-contrast industrial daylight visibility.
2. **View Mode Toggle:**
   - Switch between **SCADA Diagram View** (interactive FUXA canvas) and **Fleet Telemetry Grid View** (tabular real-time card view) using the header toggle in `ScadaPanel`.
3. **Connection Status Indicator:**
   - **Green (`Connected`):** FUXA iframe and `/api/health/fuxa` respond within `<500ms` latency.
   - **Amber (`Degraded — Cached Telemetry`):** FUXA iframe is unreachable; portal automatically renders last-known machine state from Redis (`scada:machines:<departmentId>`, 5-minute TTL).
   - **Red (`Offline`):** Telemetry feed interrupted; check `/api/health` and consult `docs/control-room/fuxa-troubleshooting.md`.

---

## 3. Standard Operator Tasks in SCADA

- **Monitoring Machine State Transitions:**
  - Verify that physical haul truck and excavator state changes (`Operating`, `Standby`, `Breakdown`) reflected in SCADA tags match operator logs in `/control-room/machine-operations`.
- **Inspecting Threshold Warnings:**
  - High temperature, low pressure, or crusher overload indicators in the SCADA diagram automatically generate alerts in `AlertPanel`.
- **Manual Refresh & Reconnect:**
  - If the HMI canvas freezes after a network blip, click **Retry Connection** in `FuxaFrame` to reload the iframe and re-verify `/api/health/fuxa`.

---

## 4. Troubleshooting Common Display Issues

| Symptom                          | Cause                                                   | Operator Action                                                                          |
| :------------------------------- | :------------------------------------------------------ | :--------------------------------------------------------------------------------------- |
| **Amber Degraded Mode Banner**   | Cloudflare tunnel or on-prem FUXA container unreachable | Continue monitoring via the fallback Fleet Telemetry Grid; notify SCADA team if >5 mins  |
| **Stale Gauge Readings (>60s)**  | Upstream Supabase webhook `/api/telemetry/push` delayed | Check `/api/health/redis` and `/api/health/supabase-realtime`                            |
| **Iframe Blank / Timeout (15s)** | Invalid `NEXT_PUBLIC_FUXA_URL` or TLS/CORS block        | Switch to Grid View and escalate to DevOps (`docs/operations/FUXA_PRODUCTION_CONFIG.md`) |
