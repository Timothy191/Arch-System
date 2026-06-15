# FUXA SCADA Integration - Production Configuration Guide

**Purpose:** Configure FUXA SCADA integration for production deployment  
**Last Updated:** 2026-06-15  
**Priority:** CRITICAL (Blocking for production launch)

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
const corsOrigins = [
  "https://portal.production-mining.com",
  "https://portal.staging-mining.com",
];
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
