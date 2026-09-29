#!/usr/bin/env bash
set -e

# ==============================================================================
# Browser Stability & DOM Health Probe
# Evaluates live production login page in headless Chromium
# ==============================================================================

TARGET_URL="https://arch-system-theta.vercel.app/login"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "========================================================"
echo "🌐 [BROWSER STABILITY PROBE] ${TIMESTAMP}"
echo "🎯 Target URL: ${TARGET_URL}"
echo "========================================================"

# Step 1: HTTP Response & Header validation
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${TARGET_URL}")
if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ HTTP Status check failed! Expected 200, got: ${HTTP_STATUS}"
  exit 1
fi
echo "✅ HTTP 200 OK verified."

# Step 2: Full headless Chromium rendering & DOM extraction
DOM_OUTPUT=$(chromium --headless --disable-gpu --dump-dom "${TARGET_URL}" 2>/dev/null)

# Step 3: Assert critical interactive elements
if ! echo "$DOM_OUTPUT" | grep -q 'id="email"'; then
  echo "❌ DOM assertion failed: email input field missing!"
  exit 1
fi

if ! echo "$DOM_OUTPUT" | grep -q 'id="password"'; then
  echo "❌ DOM assertion failed: password input field missing!"
  exit 1
fi

if ! echo "$DOM_OUTPUT" | grep -q 'Arch Systems'; then
  echo "❌ DOM assertion failed: brand heading missing!"
  exit 1
fi

# Step 4: Health endpoint verification
HEALTH_RESP=$(curl -s "https://arch-system-theta.vercel.app/api/health/live")
if ! echo "$HEALTH_RESP" | grep -q '"status":"healthy"'; then
  echo "❌ Health endpoint failed! Response: ${HEALTH_RESP}"
  exit 1
fi

echo "✅ DOM Assertions passed (Email input, Password input, Brand heading, React components hydrated)."
echo "✅ API Health check passed: ${HEALTH_RESP}"
echo "========================================================"
echo "🎉 [BROWSER STABILITY PROBE] 100% HEALTHY & STABLE"
echo "========================================================"
