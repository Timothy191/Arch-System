#!/usr/bin/env bash
set -euo pipefail

REDIS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REDIS_ROOT/docker-compose.yml"
HOST_PORT="${REDIS_HOST_PORT:-6380}"

if [ -f "$REDIS_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REDIS_ROOT/.env"
  set +a
  HOST_PORT="${REDIS_HOST_PORT:-$HOST_PORT}"
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE")
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose -f "$COMPOSE_FILE")
else
  echo "error: docker compose is required" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "error: Docker is not running — start Docker, then retry pnpm redis:dev" >&2
  exit 1
fi

echo "Starting Arch Redis offload stack on 127.0.0.1:${HOST_PORT}..."
"${COMPOSE_CMD[@]}" up -d

for _ in $(seq 1 30); do
  status=$(docker inspect --format='{{.State.Health.Status}}' arch-redis-offload 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    echo "Redis offload ready — set REDIS_URL=redis://127.0.0.1:${HOST_PORT} in 00_applications/portal/.env"
    exit 0
  fi
  sleep 1
done

echo "warn: Redis container started but health check pending — run pnpm redis:status" >&2
