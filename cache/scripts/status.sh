#!/usr/bin/env bash
set -euo pipefail

REDIS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST_PORT="${REDIS_HOST_PORT:-6380}"

if [ -f "$REDIS_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REDIS_ROOT/.env"
  set +a
  HOST_PORT="${REDIS_HOST_PORT:-$HOST_PORT}"
fi

REDIS_URL="redis://127.0.0.1:${HOST_PORT}"

echo "Arch Redis offload — ${REDIS_URL}"

if docker ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null | grep -q '^arch-redis-offload'; then
  docker ps --filter name=arch-redis-offload --format '  container: {{.Names}}  {{.Status}}  {{.Ports}}'
else
  echo "  container: not running"
fi

if command -v redis-cli >/dev/null 2>&1; then
  if redis-cli -u "$REDIS_URL" PING 2>/dev/null | grep -q PONG; then
    echo "  ping: PONG"
    exit 0
  fi
fi

if (timeout 1 bash -c "echo >/dev/tcp/127.0.0.1/${HOST_PORT}") 2>/dev/null; then
  echo "  port: open"
  exit 0
fi

echo "  ping: unreachable"
exit 1
