# Arch-System Remote Support & Desktop Assistance Deployment Runbook

This runbook explains how to configure **Tier 1** (zero-download WebRTC screen assist + portal co-browsing) and **Tier 2** (embedded HTML5 OS desktop control for managed workstations).

---

## 1. Tier 1 — WebRTC + TURN Relay (Required for Public / Corporate NAT Traversal)

Tier 1 works out of the box with Supabase Realtime signaling. For reliable peer connections across corporate firewalls, mobile LTE, and symmetric NATs, configure a TURN relay in Vercel and `.env`:

### Option A — Cloudflare Calls TURN (Recommended)

1. In Cloudflare Dashboard → **Calls** → **TURN App**, generate a TURN Key (`CLOUDFLARE_CALLS_TURN_TOKEN_ID`) and API Token (`CLOUDFLARE_CALLS_TURN_API_TOKEN`).
2. Add both to Vercel Environment Variables (Production + Preview).
3. `/api/support/ice-servers` will automatically mint 1-hour ephemeral TURN credentials per session.

### Option B — Self-Hosted `coturn`

1. Set `TURN_SHARED_SECRET` and `TURN_REALM` in `.env` on the site server.
2. Start `coturn`:
   ```bash
   docker compose -f infra/docker/compose.remote-support.yml --profile turn up -d coturn
   ```
3. Set `TURN_URLS=turns:turn.yourdomain.com:5349?transport=tcp,turn:turn.yourdomain.com:3478?transport=udp` and `TURN_SHARED_SECRET` in Vercel.

---

## 2. Tier 2 — Self-Hosted HTML5 OS Desktop Gateway (`guacd` + `arch-guac-bridge`)

Tier 2 lets authorized `admin` and `supervisor` support engineers control managed site/office Windows/Linux machines inside `/admin/support` with zero downloads on the employee's device.

1. Generate a strong shared secret (`>= 32` characters):
   ```bash
   openssl rand -hex 32
   ```
2. Set `REMOTE_DESKTOP_TOKEN_SECRET` identically on:
   - Your Vercel project (`REMOTE_DESKTOP_TOKEN_SECRET`)
   - Your on-prem/VPN host running Docker
3. Start the Tier 2 gateway stack:
   ```bash
   REMOTE_DESKTOP_TOKEN_SECRET="<your-secret>" \
     docker compose -f infra/docker/compose.remote-support.yml up -d
   ```
4. Expose `http://127.0.0.1:8085` securely via Cloudflare Tunnel (`infra/cloudflared/production-tunnel.yml.example` → `remote-gw.yourdomain.com`) protected by Cloudflare Access or tunnel-only routing.
5. Set in Vercel:
   - `NEXT_PUBLIC_REMOTE_DESKTOP_GATEWAY_URL=wss://remote-gw.yourdomain.com`
   - `REMOTE_DESKTOP_GATEWAY_URL=wss://remote-gw.yourdomain.com`

---

## 3. Preparing Managed Workstations (Zero Per-Incident Installs)

### Windows Workstations (GPO / Intune)

- Enable Remote Desktop (NLA enabled):
  ```powershell
  Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name "fDenyTSConnections" -Value 0
  Enable-NetFirewallRule -DisplayGroup "Remote Desktop"
  ```
- Restrict Windows Firewall rule to accept TCP `3389` **only** from the `arch-guacd` server subnet.

### Linux / SCADA Operator Terminals

- Install `xrdp` or `x11vnc` (bound to internal/VPN subnet only, TCP `3389` or `5900`).

### Roaming Off-VPN Laptops (Optional MeshCentral)

- For laptops outside the corporate VPN without RDP reachability, deploy the **MeshCentral** agent once via Intune/GPO and register the device in `/admin/support` → **Managed Workstations** with protocol `meshcentral`.

---

## 4. Verification

```bash
# 1. Verify bridge health locally
curl -fsS http://127.0.0.1:8085/health

# 2. Verify bridge launch token crypto tests
node --test infra/remote-support-bridge/token.test.mjs
```
