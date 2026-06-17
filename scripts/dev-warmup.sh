#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"
ENDPOINT="http://localhost:${PORT}/api/health/warmup"
MAX_RETRIES="${WARMUP_RETRIES:-20}"
RETRY_DELAY="${WARMUP_DELAY:-2}"

info() {
  printf "\e[36m→ %s\e[0m\n" "$*"
}

ok() {
  printf "\e[32m✓ %s\e[0m\n" "$*"
}

fail() {
  printf "\e[31m✗ %s\e[0m\n" "$*" >&2
  exit 1
}

info "Warming up stack via ${ENDPOINT}"

for i in $(seq 1 "${MAX_RETRIES}"); do
  if curl -fs -o /dev/null "${ENDPOINT}"; then
    ok "Warmup endpoint is healthy"
    exit 0
  fi

  if [ "${i}" -eq "${MAX_RETRIES}" ]; then
    fail "Warmup failed after ${MAX_RETRIES} attempts"
  fi

  sleep "${RETRY_DELAY}"
done
