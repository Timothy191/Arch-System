#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# Arch-Systems — Unified Dev Deployment Script
# Starts Docker, Supabase, clears caches, launches Next.js,
# checks health, and auto-opens default browser to login page.
# ──────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3000
LOGIN_URL="http://localhost:$PORT/login"
PORTAL_LOG="$REPO_ROOT/portal.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

log() {
  echo -e "${GREEN}[DEPLOY:DEV]${NC} $*"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
}

phase() {
  echo -e "\n${MAGENTA}${BOLD}━━━ Phase $1: $2 ━━━${NC}"
}

# Ensure we run from repo root
cd "$REPO_ROOT"

# ── Phase 1: Port 3000 Cleanup ────────────────────────────
phase 1 "Next.js Port Cleanup"
PIDS=$(sudo ss -tulpn | grep -E "\b:$PORT\b" | grep -oE "pid=[0-9]+" | cut -d= -f2 | sort -u || true)
if [ -n "$PIDS" ]; then
  for PID in $PIDS; do
    log "Found stale Next.js server on port $PORT (PID $PID). Terminating..."
    sudo kill -9 "$PID" || true
  done
  sleep 1.5
  log "Port $PORT cleared."
else
  log "Port $PORT is already free."
fi

# ── Phase 2: Start Docker & Supabase ──────────────────────
phase 2 "Backend Infrastructure (Docker & Supabase)"
if ! docker info >/dev/null 2>&1; then
  log "Docker is not running. Attempting to start it..."
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start docker
  else
    error "systemctl not found. Please start Docker manually."
    exit 1
  fi
  
  # Wait for Docker to boot
  for i in {1..15}; do
    if docker info >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi
log "Docker is running."

# Start Supabase if not responsive
if curl -fs "http://127.0.0.1:54321/rest/v1/" >/dev/null 2>&1; then
  log "Supabase API is already responding at http://localhost:54321."
else
  log "Starting Supabase local stack..."
  nohup pnpm --filter @repo/database supabase:dev >/dev/null 2>&1 &
  DB_PID=$!
  disown "$DB_PID"
  
  # Wait for Supabase to respond
  log "Waiting for Supabase API to become healthy..."
  for i in {1..30}; do
    if curl -fs "http://127.0.0.1:54321/rest/v1/" >/dev/null 2>&1; then
      log "Supabase API is healthy."
      break
    fi
    sleep 2
  done
fi

# ── Phase 3: Cache Cleanup ────────────────────────────────
phase 3 "Cleaning Stale Compilation Cache"
if [ -d "apps/portal/.next" ]; then
  log "Removing apps/portal/.next directory to prevent Turbopack 404 cache loops..."
  rm -rf apps/portal/.next
  log "Cache cleaned."
else
  log "No cache directory to clean."
fi

# ── Phase 4: Launch Dev Server ────────────────────────────
phase 4 "Starting Next.js Portal"
log "Clearing old portal log..."
: > "$PORTAL_LOG"

log "Starting Next.js development server on port $PORT in a detached session..."
cd apps/portal
nohup setsid ./node_modules/.bin/next dev --turbopack --hostname 0.0.0.0 --port "$PORT" > "$PORTAL_LOG" 2>&1 &
cd "$REPO_ROOT"

# ── Phase 5: Gated Health Check ───────────────────────────
phase 5 "Waiting for Compilation to Complete"
# Sleep 3 seconds initially to allow Next.js to start and create manifest files, preventing ENOENT errors
log "Allowing dev server 3s to initialize directories..."
sleep 3

log "Polling $LOGIN_URL for health status..."
COMPILED=false
for i in {1..60}; do
  if curl -fs "$LOGIN_URL" -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q 200; then
    COMPILED=true
    break
  fi
  
  # Fail early if the port is NOT bound after 6 seconds (meaning next dev failed to start or crashed)
  if [ "$i" -gt 3 ]; then
    if ! sudo ss -tulpn | grep -q -E "\b:$PORT\b"; then
      error "Next.js dev server is not running on port $PORT. Logs:"
      tail -n 30 "$PORTAL_LOG"
      exit 1
    fi
  fi
  
  sleep 2
done

if [ "$COMPILED" = "true" ]; then
  log "Next.js dev server is ready!"
  # Save the background PID of the listening process
  PORTAL_PID=$(sudo ss -tulpn | grep -E "\b:$PORT\b" | grep -oE "pid=[0-9]+" | cut -d= -f2 | head -n1 || true)
  if [ -n "$PORTAL_PID" ]; then
    echo "$PORTAL_PID" > "$REPO_ROOT/.portal.pid"
    log "Saved portal PID $PORTAL_PID to .portal.pid"
  fi
else
  error "Timed out waiting for compilation. Check portal.log:"
  tail -n 30 "$PORTAL_LOG"
  exit 1
fi

# ── Phase 6: Auto-Open Browser ────────────────────────────
phase 6 "Launching Web Browser"
log "Opening $LOGIN_URL in your default web browser..."
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$LOGIN_URL" >/dev/null 2>&1 &
elif command -v google-chrome >/dev/null 2>&1; then
  google-chrome --new-window "$LOGIN_URL" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "$LOGIN_URL"
else
  warn "Could not open browser automatically. Please visit: $LOGIN_URL"
fi

echo -e "\n${GREEN}${BOLD}─────────────────────────────────────────${NC}"
echo -e "${GREEN}${BOLD}✅ DEPLOYMENT COMPLETE!                   ${NC}"
echo -e "${GREEN}${BOLD}Portal:  http://localhost:3000            ${NC}"
echo -e "${GREEN}${BOLD}Login:   http://localhost:3000/login      ${NC}"
echo -e "${GREEN}${BOLD}─────────────────────────────────────────${NC}\n"
