#!/usr/bin/env bash
# Arch-Systems Portal Watchdog Script
# Runs as a Cron job or systemd timer to verify system-wide health and self-heal.
#
# Usage:
#   * * * * * /home/tim/Documents/Arch-System/scripts/watchdog.sh >> /var/log/arch-watchdog.log 2>&1

set -euo pipefail

HEALTH_URL="http://localhost:3000/api/health"

log_msg() {
  echo "$(date +'%Y-%m-%d %H:%M:%S') - $1"
}

# 1. Check if the portal is reachable and healthy
if ! STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL"); then
  log_msg "ERROR: Portal is completely unreachable (connection refused/timeout)."
  PORTAL_UP=false
else
  PORTAL_UP=true
fi

# 2. Self-heal if unhealthy
if [ "$PORTAL_UP" = false ] || [ "$STATUS_CODE" -ne 200 ]; then
  if [ "$PORTAL_UP" = true ]; then
    log_msg "WARN: Portal returned unhealthy status code: $STATUS_CODE"
  fi
  
  log_msg "INFO: Triggering self-healing restart of the arch-system service..."
  
  # Try to restart the systemd service (requires sudo/root permissions)
  if command -v systemctl >/dev/null 2>&1; then
    if sudo systemctl restart arch-system; then
      log_msg "SUCCESS: arch-system service restarted successfully."
    else
      log_msg "ERROR: Failed to restart arch-system service via systemctl."
    fi
  else
    log_msg "WARN: systemctl not found. Attempting local process recovery fallback..."
    # Fallback to restarting docker containers if systemd is not used
    if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
      docker compose restart portal
      log_msg "SUCCESS: portal container restarted successfully."
    fi
  fi
else
  # System is healthy
  exit 0
fi
