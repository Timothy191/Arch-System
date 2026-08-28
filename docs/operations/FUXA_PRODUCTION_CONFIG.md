# FUXA SCADA Integration - Production Configuration Guide

**Purpose:** Configure FUXA SCADA integration for production deployment  
**Last Updated:** 2026-08-28 (reverse-flow redesign)  
**Priority:** CRITICAL (Blocking for production launch)

> **Authoritative architecture:** see `docs/operations/fuxa-integration-plan.md`
> (Reverse-Flow Ingest section). The sections below written 2026-06-15 described
> the abandoned forward (push-to-FUXA) model; treat them as legacy reference
> only.

---

## Current Production Architecture (reverse-flow)

Production FUXA **pulls** telemetry from the portal; the portal never pushes to
FUXA (FUXA exposes no tag-write endpoint).

```
On-prem FUXA box (bridge network, :8088)
  └─ WebAPI device, getTags = https://portal.production-mining.com/api/scada/tags
        (via Cloudflare tunnel — infra/cloudflared/fuxa-tunnel.yml)
Portal (Next.js, public)
  └─ GET  /api/scada/tags        → serves Redis telemetry cache (system of record)
  └─ POST /api/telemetry/push   → Supabase webhook writes Redis
Browser (operator, control-room)
  └─ FuxaFrame iframe → NEXT_PUBLIC_FUXA_URL (FUXA runtime via tunnel)
```

**Production checklist (reverse-flow):**

- [ ] `NEXT_PUBLIC_FUXA_URL=https://fuxa.production-mining.com` (tunnel) in prod `.env`
- [ ] FUXA runs on the on-prem box on a **bridge network** — **not**
      `network_mode: host` (which is dev-only; see `infra/docker/compose.scada.yml`)
      — bridged via `infra/cloudflared/fuxa-tunnel.yml`
- [ ] FUXA WebAPI device imported from `templates/fuxa-portal-connection.json`
      with `getTags` = `https://portal.production-mining.com/api/scada/tags`
- [ ] Dashboard authored with `scripts/fuxa-gauge-grid.py` (`--fuxa-url
  https://fuxa.production-mining.com --tags-url
  https://portal.production-mining.com/api/scada/tags`)
- [ ] **`/api/scada/tags` access gated in prod** — it exposes machine telemetry.
      Restrict to the FUXA origin (tunnel), an internal header/token, or Supabase
      auth. It is unauthenticated in dev (FUXA on host networking, same host).
- [ ] **FUXA security enabled** in prod (`secureEnabled`) + a FUXA user/login;
      set `FUXA_API_KEY` and send it as `x-api-key` for FUXA API calls
- [ ] SSL/TLS on `fuxa.production-mining.com` + `portal.production-mining.com`;
      latency < 500 ms; light theme (`apps/portal/public/css/fuxa-light-theme.css`)

The legacy sections below (CORS-for-iframe, forward dashboard-ID mapping) are
superseded by the reverse-flow model above.

---

## 🚨 **Configuration Required**

### **Environment Variable**

```bash
# Production .env configuration
NEXT_PUBLIC_FUXA_URL=https://your-fuxa-production-domain.com
```

### **Current Configuration (Development)**

```bash
# apps/portal/.env.example (current)
NEXT_PUBLIC_FUXA_URL=http://localhost:1881
```

---

## 📋 **Pre-Production Checklist**

- [ ] **FUXA Server Deployment**
  - [ ] FUXA server deployed and accessible from production environment
  - [ ] SSL/TLS certificate configured (HTTPS required for production)
  - [ ] CORS configured to allow portal domain
  - [ ] Firewall rules allow portal server to access FUXA
  - [ ] FUXA dashboards created and published

- [ ] **Network Configuration**
  - [ ] DNS resolution configured for FUXA domain
  - [ ] SSL certificate valid and not expired
  - [ ] Network latency acceptable (<500ms target)
  - [ ] Connectivity tested from production environment

- [ ] **FUXA Configuration**
  - [ ] Dashboard IDs documented for specific views
  - [ ] Authentication configured (if required)
  - [ ] Performance optimized for iframe embedding
  - [ ] Light theme CSS configured

---

## 🔧 **Configuration Steps**

### **1. Set Production Environment Variable**

```bash
# In production environment (.env file)
NEXT_PUBLIC_FUXA_URL=https://fuxa.production-mining.com
```

### **2. Verify FUXA Accessibility**

```bash
# Test connectivity from production server
curl -I https://fuxa.production-mining.com

# Expected response: HTTP 200 with proper headers
```

### **3. Configure CORS in FUXA**

```javascript
// FUXA server configuration
// Allow portal domain to embed FUXA in iframe
const corsOrigins = ["https://portal.production-mining.com", "https://portal.staging-mining.com"];
```

### **4. Test iframe Loading**

```javascript
// Test in browser console
const testFuxa = () => {
  const iframe = document.createElement("iframe");
  iframe.src = process.env.NEXT_PUBLIC_FUXA_URL;
  iframe.onload = () => console.log("FUXA loaded successfully");
  iframe.onerror = () => console.error("FUXA failed to load");
  document.body.appendChild(iframe);
};
```

---

## 🎯 **FUXA Dashboard Configuration**

### **Dashboard ID Mapping**

```typescript
// Configure in FuxaFrame.tsx when specific dashboards are ready
const FUXA_DASHBOARDS = {
  "control-room": "dashboard-id-123", // Main control room view
  machines: "dashboard-id-456", // Machine-specific view
  overview: "dashboard-id-789", // Overview dashboard
};
```

### **Theme Configuration**

```css
/* public/css/fuxa-light-theme.css */
/* Custom FUXA light theme for iframe injection */
/* This file will be injected into FUXA iframe */
```

---

## ⚠️ **Troubleshooting**

### **FUXA Not Loading**

**Symptoms:** Iframe shows timeout error after 15 seconds  
**Causes:**

- Network connectivity issues
- CORS misconfiguration
- FUXA server down
- Invalid URL

**Resolution:**

1. Test FUXA URL directly in browser
2. Check network tab for CORS errors
3. Verify firewall rules
4. Test with `curl -I` from server

### **CORS Errors**

**Symptoms:** Browser console shows CORS policy errors  
**Resolution:**

1. Add portal domain to FUXA CORS whitelist
2. Verify SSL certificate is valid
3. Check for mixed content (HTTP vs HTTPS)

### **Performance Issues**

**Symptoms:** Slow iframe load times  
**Resolution:**

1. Optimize FUXA dashboard performance
2. Enable caching on FUXA server
3. Consider CDN for FUXA static assets
4. Monitor network latency

---

## 🔄 **Fallback Strategy**

When FUXA is unavailable, the system will:

1. Show degraded mode with cached machine data
2. Display connection status indicator (yellow/red)
3. Provide retry functionality
4. Fall back to machine list view

### **Cached Data Strategy**

```typescript
// Cache configuration for FUXA fallback
const SCADA_CACHE_KEY = `scada:machines:${departmentId}`;
const SCADA_CACHE_TTL = 300; // 5 minutes
```

---

## 📊 **Monitoring**

### **Health Check Endpoint**

```
GET /api/health/fuxa
```

**Response:**

```json
{
  "status": "healthy" | "degraded" | "down",
  "latency_ms": 123,
  "last_check": "2026-06-15T10:30:00Z"
}
```

### **Metrics to Monitor**

- FUXA iframe load time
- FUXA connection success rate
- Degraded mode activation frequency
- Cache hit/miss rate

---

## ✅ **Production Verification**

After configuration, verify:

- [ ] FUXA iframe loads successfully in production portal
- [ ] Light theme CSS injects correctly
- [ ] Real-time updates work in SCADA view
- [ ] Degraded mode activates when FUXA unavailable
- [ ] Health check endpoint returns correct status
- [ ] No CORS errors in browser console
- [ ] Performance meets targets (<3s load time)

---

## 📞 **Support Contacts**

- **FUXA Issues:** SCADA Team
- **Network/Infrastructure:** DevOps Team
- **Portal Integration:** Frontend Team

---

_Configuration must be completed before production launch. FUXA integration is blocking for control room functionality._
