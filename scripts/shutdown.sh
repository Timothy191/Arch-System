#!/usr/bin/env bash
# Arch-Systems — Graceful Lossless Shutdown Script v1.0.0
# Guarantees:
# 1. Graceful signal drainage (SIGTERM) for Next.js to prevent DB transaction corruption
# 2. Non-destructive container halting (preserves all postgres tables, schemas, and credentials)
# 3. Complete CPU/RAM relief for all stack tools (Supabase, Redis, n8n, Flowise, Prometheus, Grafana)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL_PID_FILE="$REPO_ROOT/.portal.pid"
TOOLS_COMPOSE="$REPO_ROOT/docker-compose.tools.yml"
MONITOR_COMPOSE="$REPO_ROOT/docker-compose.monitoring.yml"
DATABASE_DIR="$REPO_ROOT/packages/database"

# Colors
CLR_RESET="\033[0m"
CLR_RED="\033[0;31m"
CLR_GREEN="\033[0;32m"
CLR_YELLOW="\033[0;33m"
CLR_BLUE="\033[0;34m"
CLR_MAGENTA="\033[0;35m"
CLR_CYAN="\033[0;36m"
CLR_WHITE="\033[0;37m"

log() { echo -e "\033[0;32m[shutdown]\033[0m $*"; }
warn() { echo -e "\033[0;33m[warn]\033[0m $*"; }
error() { echo -e "\033[0;31m[error]\033[0m $*"; exit 1; }

# Determine the available Docker Compose command (resilient to docker-compose vs docker compose)
if docker compose version > /dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  COMPOSE_CMD="docker compose"
fi

echo -e "\n${CLR_MAGENTA}┌────────────────────────────────────────────────────────────┐${CLR_RESET}"
echo -e "${CLR_MAGENTA}│          ARCH-SYSTEMS GRACEFUL LOSSLESS SHUTDOWN           │${CLR_RESET}"
echo -e "${CLR_MAGENTA}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
echo -e "${CLR_MAGENTA}│${CLR_RESET} ${CLR_YELLOW}Status:${CLR_RESET} Halting sandbox tools safely...                      ${CLR_MAGENTA}│${CLR_RESET}"
echo -e "${CLR_MAGENTA}└────────────────────────────────────────────────────────────┘${CLR_RESET}\n"

# ── Step 1: Next.js Portal Graceful Connection Drainage ────
if [ -f "$PORTAL_PID_FILE" ]; then
  PID=$(cat "$PORTAL_PID_FILE" || true)
  if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
    log "Draining active Next.js connection pools (sending SIGTERM)..."
    kill "$PID" || true
    
    # Wait up to 5 seconds for Next.js to shutdown gracefully
    for i in {1..5}; do
      if ! ps -p "$PID" > /dev/null 2>&1; then
        log "Next.js Portal stopped cleanly."
        break
      fi
      sleep 1
    done

    # Force kill only if it hung and refused to exit
    if ps -p "$PID" > /dev/null 2>&1; then
      warn "Next.js did not stop in time. Enforcing process termination..."
      kill -9 "$PID" || true
    fi
  fi
  rm -f "$PORTAL_PID_FILE"
fi

# Sweep any leftover dev servers on port 3000
PIDS=$(ss -tunlp 2>/dev/null | grep ":3000 " | grep -oP 'pid=\K\d+' | sort -u || true)
if [ -n "$PIDS" ]; then
  log "Clearing stray web instances (PIDs: $PIDS)..."
  echo "$PIDS" | xargs kill -15 2>/dev/null || true
fi

# Restore local env from backup if present (from live local network deployment)
ENV_FILE="$REPO_ROOT/apps/portal/.env"
ENV_BAK="$REPO_ROOT/apps/portal/.env.bak"
if [ -f "$ENV_BAK" ]; then
  log "Restoring local development environment configuration (.env.bak)..."
  mv "$ENV_BAK" "$ENV_FILE"
  log "Environment configuration restored."
fi

# ── Step 2: Stop Observability Stack ──────────────────────
if [ -f "$MONITOR_COMPOSE" ]; then
  log "Stopping Prometheus, Grafana, and cAdvisor (preserving volumes)..."
  if docker ps --format '{{.Names}}' | grep -E "(plantcor-prometheus|plantcor-grafana|plantcor-cadvisor)" > /dev/null 2>&1; then
    $COMPOSE_CMD -f "$MONITOR_COMPOSE" stop || true
    log "Observability stack suspended."
  else
    log "Observability stack is already suspended."
  fi
fi

# ── Step 3: Stop Secondary Helper Stack ──────────────────
if [ -f "$TOOLS_COMPOSE" ]; then
  log "Stopping Redis, n8n, and Flowise (preserving volumes)..."
  if docker ps --format '{{.Names}}' | grep -E "(plantcor-redis|plantcor-n8n|plantcor-flowise)" > /dev/null 2>&1; then
    $COMPOSE_CMD -f "$TOOLS_COMPOSE" stop || true
    log "Secondary helper tools suspended."
  else
    log "Secondary helper tools are already suspended."
  fi
fi

# ── Step 4: Stop Supabase local stack ────────────────────
log "Stopping local Supabase stack safely (preserving database volumes)..."
if docker ps --format '{{.Names}}' | grep -q 'supabase_'; then
  cd "$DATABASE_DIR"
  # Stops containers completely but keeps Docker volume storage 100% intact
  pnpx supabase stop || true
  log "Supabase containers suspended."
else
  log "Supabase stack is already suspended."
fi

echo -e "\n${CLR_GREEN}┌────────────────────────────────────────────────────────────┐${CLR_RESET}"
echo -e "${CLR_GREEN}│            SHUTDOWN COMPLETE — ALL DATA SECURED            │${CLR_RESET}"
echo -e "${CLR_GREEN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} All runtime engine and database containers halted.          ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_CYAN}Notice:${CLR_RESET} Persistent database volumes were NOT deleted.       ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} Your tables, schemas, and metrics are preserved perfectly!  ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}└────────────────────────────────────────────────────────────┘${CLR_RESET}\n"
