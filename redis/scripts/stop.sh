#!/usr/bin/env bash
set -euo pipefail

REDIS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REDIS_ROOT/docker-compose.yml"

if docker compose version >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" stop
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose -f "$COMPOSE_FILE" stop
else
  echo "error: docker compose is required" >&2
  exit 1
fi

echo "Redis offload stack stopped (volume preserved)."
