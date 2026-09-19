#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
N8N_URL="${N8N_URL:-http://192.168.1.79:5678}"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"

pass_count=0
fail_count=0
warn_count=0

pass_check() {
  printf '[PASS] %s\n' "$1"
  pass_count=$((pass_count + 1))
}

fail_check() {
  printf '[FAIL] %s\n' "$1"
  fail_count=$((fail_count + 1))
}

warn_check() {
  printf '[WARN] %s\n' "$1"
  warn_count=$((warn_count + 1))
}

http_check() {
  local name="$1"
  local url="$2"
  local expected_status="$3"
  local actual_status

  actual_status=$(curl -sS -o /dev/null -w '%{http_code}' \
    --connect-timeout 3 --max-time 8 "$url" 2>/dev/null || true)

  if [[ "$actual_status" == "$expected_status" ]]; then
    pass_check "$name ($actual_status)"
  else
    fail_check "$name (expected $expected_status, got ${actual_status:-no response})"
  fi
}

printf '%s\n' 'n8n and automation service verification'
printf 'n8n: %s\nRedis: %s\n\n' "$N8N_URL" "$REDIS_URL"

http_check "n8n health" "${N8N_URL%/}/healthz" "200"
http_check "n8n unauthenticated API boundary" "${N8N_URL%/}/api/v1/workflows" "401"
http_check "portal liveness" "http://127.0.0.1:3000/api/health/live" "200"
http_check "Flowise" "http://127.0.0.1:3001/api/v1/ping" "200"
http_check "Langfuse" "http://127.0.0.1:3003/api/public/health" "200"
http_check "Qdrant" "http://127.0.0.1:6333/healthz" "200"
http_check "ClickHouse" "http://127.0.0.1:8123/ping" "200"
http_check "Prometheus" "http://127.0.0.1:9092/-/healthy" "200"
http_check "Ollama" "http://127.0.0.1:11434/api/tags" "200"

if [[ "$REDIS_URL" == "redis://127.0.0.1:6379" ]]; then
  if (cd "$REPO_ROOT/packages/redis" && REDIS_URL="$REDIS_URL" node --input-type=module -e '
    import { createClient } from "redis";
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
    const response = await client.ping();
    await client.quit();
    if (response !== "PONG") process.exit(1);
  '); then
    pass_check "Redis protocol PING"
  else
    fail_check "Redis protocol PING"
  fi
else
  warn_check "Redis URL is not the required loopback endpoint"
fi

for service in mqtt minio vaultwarden uptime-kuma netdata; do
  warn_check "$service is external to this repository and was not probed"
done

printf '\nSummary: %d passed, %d failed, %d warnings\n' "$pass_count" "$fail_count" "$warn_count"

if (( fail_count > 0 )); then
  exit 1
fi