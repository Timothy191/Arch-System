# FUXA SCADA Troubleshooting Guide

**Last Updated:** 2026-06-15  
**System:** FUXA SCADA Integration  
**Component:** Control Room Department

---

## Overview

FUXA is a web-based SCADA (Supervisory Control and Data Acquisition) system that provides real-time monitoring and control of mining equipment. This guide covers common issues, resolution procedures, and configuration requirements for the FUXA integration in the Control Room system.

---

## Configuration Requirements

### Environment Variables

The FUXA integration requires the following environment variable to be configured:

```bash
NEXT_PUBLIC_FUXA_URL=https://your-fuxa-domain.com
```

- **Development**: Typically `http://localhost:1881`
- **Staging**: Your staging FUXA server URL
- **Production**: Your production FUXA server URL

### Verifying FUXA URL

To verify the FUXA URL is correct:

```bash
curl -I ${NEXT_PUBLIC_FUXA_URL}
```

Expected response:

- HTTP 200 or 302 (redirect)
- Proper CORS headers if cross-origin

### Dashboard ID Configuration

FUXA displays specific dashboards based on department views. Ensure dashboard IDs are mapped correctly in the FUXA server configuration.

---

## Common Issues and Solutions

### Issue 1: FUXA iframe won't load

**Symptoms:**

- SCADA Dashboard view shows loading spinner indefinitely
- "FUXA unavailable" error message
- Connection status indicator shows "Offline"

**Possible Causes:**

1. FUXA server is down
2. Network connectivity issues
3. Incorrect NEXT_PUBLIC_FUXA_URL configuration
4. CORS configuration blocking iframe load

**Resolution Steps:**

1. **Check FUXA Server Status**

   ```bash
   curl ${NEXT_PUBLIC_FUXA_URL}
   ```

   - If server is down, contact SCADA administrator
   - If server is up but iframe won't load, check CORS configuration

2. **Verify Environment Variable**
   - Check `.env` file for correct NEXT_PUBLIC_FUXA_URL
   - Restart the portal application after changing the variable
   - Verify the URL is accessible from the portal server

3. **Check CORS Configuration**
   - FUXA server must allow iframe embedding from your domain
   - Add your portal domain to FUXA's allowed origins
   - FUXA configuration example:

     ```javascript
     {
       "cors": {
         "origin": ["https://your-portal-domain.com"]
       }
     }
     ```

4. **Test Direct Access**
   - Try accessing FUXA URL directly in a browser
   - If direct access works but iframe doesn't, it's a CORS issue
   - If direct access fails, it's a server or network issue

---

### Issue 2: Theme injection not working

**Symptoms:**

- FUXA dashboard loads but shows dark theme instead of light theme
- Inconsistent styling between portal and FUXA
- Theme injection error in browser console

**Possible Causes:**

1. Cross-origin restrictions preventing CSS injection
2. Missing or incorrect theme CSS file
3. FUXA blocking external scripts

**Resolution Steps:**

1. **Verify Theme File Exists**
   - Check `public/css/fuxa-light-theme.css` exists
   - Ensure CSS syntax is valid
   - Test theme file by opening directly in browser

2. **Check Cross-Origin Settings**
   - FUXA must allow script execution from your domain
   - CSP (Content Security Policy) may be blocking injection
   - Review FUXA server security headers

3. **Fallback to Default Theme**
   - If theme injection fails, FUXA will use its default theme
   - This is acceptable for operational continuity
   - Plan theme fix during maintenance window

---

### Issue 3: Frequent timeouts

**Symptoms:**

- FUXA dashboard loads slowly
- Frequent "timeout" errors
- Connection status alternating between "Connected" and "Degraded"

**Possible Causes:**

1. High latency between portal and FUXA server
2. FUXA server under heavy load
3. Network congestion or bandwidth issues
4. Large dashboard with many components

**Resolution Steps:**

1. **Check Network Latency**

   ```bash
   ping ${FUXA_DOMAIN}
   ```

   - Latency should be <100ms for optimal performance
   - High latency indicates network issues

2. **Check FUXA Server Load**
   - Contact SCADA administrator to check server metrics
   - High CPU or memory may cause slow responses
   - Consider load balancing if server is overloaded

3. **Simplify Dashboard**
   - Reduce number of components on the dashboard
   - Remove unnecessary gauges or charts
   - Optimize FUXA dashboard design

4. **Increase Timeout**
   - Edit `features/departments/components/control-room/FuxaFrame.tsx`
   - Increase timeout from 15 seconds to 30 seconds
   - This is a temporary fix while addressing root cause

---

### Issue 4: Machine data not updating

**Symptoms:**

- Machine list shows outdated data
- SCADA dashboard doesn't reflect current status
- Real-time updates not appearing

**Possible Causes:**

1. FUXA data source disconnected
2. MQTT/OPC-UA connection issues
3. Database connection problems
4. Subscription failures

**Resolution Steps:**

1. **Check FUXA Data Sources**
   - Access FUXA server directly
   - Verify data sources (MQTT, OPC-UA, modbus) are connected
   - Check for data source error messages in FUXA logs

2. **Verify Supabase Real-time**
   - Check Supabase connection status
   - Verify real-time subscriptions are active
   - Test Supabase real-time health endpoint: `/api/health/supabase-realtime`

3. **Refresh the Page**
   - Sometimes a simple page refresh resolves temporary issues
   - This re-establishes subscriptions and connections

4. **Check Machine List as Fallback**
   - Use the Machine List view instead of SCADA Dashboard
   - Machine List data comes directly from the database
   - This provides operational continuity while FUXA is investigated

---

### Issue 5: Degraded mode activation

**Symptoms:**

- Connection status shows "Degraded" (yellow)
- System shows cached data instead of real-time
- Automatic retries are happening

**Possible Causes:**

1. FUXA responding slowly but still available
2. Intermittent network issues
3. FUXA server under load but not down

**Resolution Steps:**

1. **Monitor Connection Status**
   - Watch the connection status indicator
   - Check if status alternates between Connected and Degraded
   - This indicates intermittent issues

2. **Review Cached Data**
   - Degraded mode shows last-known-good cached data
   - Data is cached in localStorage with 5-minute TTL
   - Verify cached data is reasonably current

3. **Wait for Automatic Recovery**
   - System automatically retries with exponential backoff
   - Retry intervals: 30s, 60s, 120s
   - After 3 failed attempts, shows permanent error

4. **Manual Refresh**
   - Click the refresh button to force immediate retry
   - This is available in the FUXA panel header
   - Use this if you suspect connectivity has improved

---

## Fallback Mode

### When Fallback Activates

The system enters fallback mode when:

- FUXA is completely unavailable
- All automatic retry attempts have failed
- Connection status shows "Offline" (red)

### Fallback Behavior

- **Machine List View**: Continues to work with database data
- **SCADA Dashboard View**: Shows fallback UI with message
- **Cached Data**: Displays last-known machine statuses
- **Cache Duration**: 5 minutes from last successful fetch

### Operating in Fallback Mode

1. **Use Machine List View**
   - Switch to Machine List if SCADA Dashboard is unavailable
   - Machine List pulls directly from the database
   - Status updates may be delayed but still functional

2. **Monitor for Recovery**
   - Watch connection status indicator
   - System will automatically recover when FUXA is available
   - Manual refresh button available for immediate retry

3. **Report Persistent Issues**
   - If FUXA is unavailable for >15 minutes, report to SCADA admin
   - Document the duration and impact
   - This helps identify systemic issues

---

## Health Check Endpoints

### FUXA Health Check

```
GET /api/health/fuxa
```

Response:

```json
{
  "status": "healthy" | "degraded" | "down",
  "latency_ms": 123,
  "error": "Optional error message"
}
```

### Unified Health Check

```
GET /api/health
```

Response includes FUXA status along with other services:

```json
{
  "overall": "healthy",
  "services": {
    "fuxa": {
      "status": "healthy",
      "latency_ms": 123
    },
    "supabase_realtime": {
      "status": "healthy"
    },
    "redis": {
      "status": "healthy"
    }
  }
}
```

---

## Advanced Troubleshooting

### Browser Developer Tools

Use browser developer tools to diagnose issues:

1. **Console Tab**
   - Check for JavaScript errors
   - Look for CORS-related errors
   - Identify network request failures

2. **Network Tab**
   - Filter by FUXA domain
   - Check HTTP status codes
   - Review response times
   - Look for failed requests

3. **Application Tab**
   - Check localStorage for cached data
   - Verify FUXA cache keys exist
   - Inspect cached data timestamps

### FUXA Server Logs

If you have access to FUXA server logs:

1. **Check for Errors**
   - Look for connection errors
   - Identify failed authentication attempts
   - Review data source connection issues

2. **Monitor Performance**
   - Check response times
   - Review server resource usage
   - Identify slow queries or operations

### Network Diagnostics

1. **Traceroute**

   ```bash
   traceroute ${FUXA_DOMAIN}
   ```

   - Identifies network hops and potential bottlenecks

2. **DNS Resolution**

   ```bash
   nslookup ${FUXA_DOMAIN}
   ```

   - Verifies DNS is resolving correctly

3. **Port Check**

   ```bash
   telnet ${FUXA_DOMAIN} 80
   telnet ${FUXA_DOMAIN} 443
   ```

   - Verifies HTTP/HTTPS ports are accessible

---

## Prevention and Monitoring

### Regular Checks

Perform these checks regularly:

1. **Daily**
   - Verify FUXA connection status
   - Check dashboard load time
   - Review any error logs

2. **Weekly**
   - Test health check endpoints
   - Review performance metrics
   - Check for CORS or security policy changes

3. **Monthly**
   - Review FUXA server capacity
   - Evaluate dashboard performance
   - Plan for capacity upgrades if needed

### Monitoring Setup

Configure monitoring for:

- **FUXA availability**: Uptime monitoring
- **Response time**: Performance monitoring
- **Error rates**: Alert on increased errors
- **Cache hit rate**: Ensure caching is effective

---

## Escalation Procedures

### When to Escalate

Escalate to SCADA administrator when:

- FUXA is unavailable for >15 minutes
- Frequent timeouts or degraded performance
- CORS or authentication issues that can't be resolved
- Security concerns or suspicious activity

### Information to Provide

When reporting issues, include:

- Time of issue onset
- Duration of the problem
- Error messages from browser console
- Health check endpoint results
- Impact on operations
- Steps already taken to resolve

---

## Contact Information

- **SCADA Administrator**: [Contact information]
- **IT Support**: [Contact information]
- **Portal Administrator**: [Contact information]

---

## Related Documentation

- **FUXA Production Config**: Configuration details and setup
- **Operator Onboarding Guide**: General system usage
- **Shift Closeout Runbook**: Operational procedures
- **System Architecture**: Understanding component interactions

---

**Last Review Date:** 2026-06-15  
**Next Review Date:** 2026-09-15 (quarterly)
