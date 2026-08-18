#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8288}"
SDK_URL="${SDK_URL:-http://localhost:3000/api/inngest}"
LOG_FILE="${LOG_FILE:-$REPO_ROOT/run/inngest-dev.log}"

mkdir -p "$REPO_ROOT/run"

if lsof -ti:"$PORT" > /dev/null 2>&1; then
  echo "Inngest dev server already running on port $PORT (PID $(lsof -ti:"$PORT"))"
  exit 0
fi

echo "Starting Inngest dev server on port $PORT..."
nohup inngest dev -u "$SDK_URL" > "$LOG_FILE" 2>&1 &
PID=$!
disown "$PID"
echo "$PID" > "$REPO_ROOT/run/.inngest.pid"

for i in $(seq 1 15); do
  if curl -fs "http://127.0.0.1:$PORT/api/dev" > /dev/null 2>&1; then
    echo "Inngest dev server started (PID $PID) — http://127.0.0.1:$PORT"
    exit 0
  fi
  sleep 1
done

echo "Inngest dev server may still be starting — check logs: $LOG_FILE"
