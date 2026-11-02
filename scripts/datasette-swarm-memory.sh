#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Datasette Swarm Memory Explorer
# Launches Simon Willison's Datasette to explore and query the local
# RuFlo Swarm SQLite memory database (.swarm/memory.db) via web UI or JSON API.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SWARM_DB="${ROOT_DIR}/.swarm/memory.db"
PORT="${DATASETTE_PORT:-8001}"

if [ ! -f "${SWARM_DB}" ]; then
  echo "⚡ [DATASETTE] Database not found at ${SWARM_DB}. Running sync-vector-memory..."
  node "${ROOT_DIR}/tools/scripts/sync-vector-memory.mjs"
fi

if ! command -v datasette &>/dev/null; then
  if command -v pipx &>/dev/null; then
    echo "⚡ [DATASETTE] Launching Datasette via pipx run..."
    exec pipx run datasette "${SWARM_DB}" --port "${PORT}" --setting sql_time_limit_ms 5000
  elif command -v uvx &>/dev/null; then
    echo "⚡ [DATASETTE] Launching Datasette via uvx..."
    exec uvx datasette "${SWARM_DB}" --port "${PORT}" --setting sql_time_limit_ms 5000
  else
    echo "❌ Error: datasette, pipx, or uvx is required to launch Datasette."
    echo "   Install with: uv tool install datasette  OR  pipx install datasette"
    exit 1
  fi
else
  echo "⚡ [DATASETTE] Starting Datasette on http://127.0.0.1:${PORT} against ${SWARM_DB}..."
  exec datasette "${SWARM_DB}" --port "${PORT}" --setting sql_time_limit_ms 5000
fi
