#!/usr/bin/env bash
# ==============================================================================
# Arch-CorpOS Adaptive Scheduler Engine (Win Pattern)
# Calculates dynamic next-run interval based on loop health and outcome delta.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORPOS_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${CORPOS_ROOT}/corpos.config.json"

LOOP_ID="default"
LAST_STATUS="IDLE"
CURRENT_INTERVAL=15

while [[ $# -gt 0 ]]; do
  case "$1" in
    --loop-id) LOOP_ID="$2"; shift 2 ;;
    --last-status) LAST_STATUS="$2"; shift 2 ;;
    --current-interval) CURRENT_INTERVAL="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

node -e '
  const fs = require("fs");
  const cfg = JSON.parse(fs.readFileSync("'"${CONFIG_FILE}"'", "utf8"));
  const defaults = cfg.scheduler_defaults;

  const minInterval = defaults.min_interval_minutes || 15;
  const maxInterval = defaults.max_interval_minutes || 240;
  const backoff = defaults.backoff_factor || 2.0;

  const status = "'"${LAST_STATUS}"'";
  let current = parseInt("'"${CURRENT_INTERVAL}"'", 10) || minInterval;
  let nextInterval = minInterval;

  if (status === "IDLE" || status === "SUCCESS") {
    nextInterval = Math.min(maxInterval, Math.round(current * backoff));
  } else if (status === "FAILED" || status === "ANOMALY") {
    nextInterval = minInterval;
  } else if (status === "PENDING_APPROVAL") {
    nextInterval = Math.min(60, current);
  } else {
    nextInterval = minInterval;
  }

  const now = new Date();
  const currentHourUTC = now.getUTCHours();
  let inQuietHours = false;

  if (defaults.quiet_hours && defaults.quiet_hours.enabled) {
    const startH = defaults.quiet_hours.start_hour_utc;
    const endH = defaults.quiet_hours.end_hour_utc;
    if (startH > endH) {
      inQuietHours = (currentHourUTC >= startH || currentHourUTC < endH);
    } else {
      inQuietHours = (currentHourUTC >= startH && currentHourUTC < endH);
    }
  }

  const nextRun = new Date(now.getTime() + nextInterval * 60000);

  const result = {
    loop_id: "'"${LOOP_ID}"'",
    last_status: status,
    previous_interval_minutes: current,
    next_interval_minutes: nextInterval,
    next_run_iso: nextRun.toISOString(),
    in_quiet_hours: inQuietHours
  };

  console.log(JSON.stringify(result, null, 2));
'
