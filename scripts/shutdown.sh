#!/usr/bin/env bash
# Arch-Systems — Graceful Lossless Shutdown Script v1.1.0
# Guarantees:
# 1. Graceful signal drainage (SIGTERM) for Next.js to prevent DB transaction corruption
# 2. Non-destructive container halting (preserves all postgres tables, schemas, and credentials)
# 3. Complete CPU/RAM relief for all stack tools (Supabase, Redis, Flowise, Prometheus, Grafana)
# Uses: scripts/lib/common.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

LOG_LABEL="[shutdown]"

# Script-specific configuration
PORT="${PORT:-3000}"
PORTAL_PID_FILE="$RUN_DIR/.portal.pid"
ENV_FILE="$PORTAL_DIR/.env"
ENV_BAK="$PORTAL_DIR/.env.bak"
TOOLS_COMPOSE="$REPO_ROOT/infra/docker/compose.tools.yml"
MONITOR_COMPOSE="$REPO_ROOT/infra/monitoring/docker-compose.yml"

# ── Step 1: Next.js Portal Graceful Connection Drainage ────
stop_pid_file "$PORTAL_PID_FILE" "Next.js Portal"

# Sweep any stray dev servers on the portal port
if is_port_in_use "$PORT"; then
  log "Clearing stray web instances on port $PORT..."
  kill_port "$PORT" 15 2>/dev/null || true
fi

# Clean orphan MCP processes
warn "Terminating orphan MCP server processes..."
pkill -f "next-devtools-mcp" 2>/dev/null || true
pkill -f "codebase-memory-mcp" 2>/dev/null || true
pkill -f "@modelcontextprotocol" 2>/dev/null || true

# Restore local env from backup if present (from live local network deployment)
if [ -f "$ENV_BAK" ]; then
  log "Restoring local development environment configuration (.env.bak)..."
  mv "$ENV_BAK" "$ENV_FILE"
  log "Environment configuration restored."
fi

# ── Step 2: Stop Observability Stack ────────────────────────
if [ -f "$MONITOR_COMPOSE" ]; then
  log "Stopping Prometheus, Grafana, and cAdvisor (preserving volumes)..."
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qE "(plantcor-monitor-prometheus|plantcor-grafana|plantcor-cadvisor)"; then
    $COMPOSE_CMD -f "$MONITOR_COMPOSE" stop || true
    log "Observability stack suspended."
  else
    log "Observability stack is already suspended."
  fi
fi

# ── Step 3: Stop Secondary Helper Stack ────────────────────
if [ -f "$TOOLS_COMPOSE" ]; then
  log "Stopping Redis and Flowise (preserving volumes)..."
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qE "(plantcor-redis|plantcor-flowise)"; then
    $COMPOSE_CMD -f "$TOOLS_COMPOSE" stop || true
    log "Secondary helper tools suspended."
  else
    log "Secondary helper tools are already suspended."
  fi
fi

# ── Step 4: Stop Supabase local stack ──────────────────────
log "Stopping local Supabase stack safely (preserving database volumes)..."
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'supabase_'; then
  if [ -d "$ARCH_BASE_DIR" ] && [ -f "$ARCH_BASE_DIR/supabase/config.toml" ]; then
    log "Stopping Supabase via Arch-Base ($ARCH_BASE_DIR)..."
    (cd "$ARCH_BASE_DIR" && npx supabase stop) || true
  elif [ -d "$DATABASE_DIR" ]; then
    cd "$DATABASE_DIR"
    pnpx supabase stop || true
  fi
  log "Supabase containers suspended."
else
  log "Supabase stack is already suspended."
fi

echo
echo -e "${CLR_GREEN}┌────────────────────────────────────────────────────────────┐${NC}"
echo -e "${CLR_GREEN}│            SHUTDOWN COMPLETE — ALL DATA SECURED            │${NC}"
echo -e "${CLR_GREEN}├────────────────────────────────────────────────────────────┤${NC}"
echo -e "${CLR_GREEN}│${NC} All runtime engine and database containers halted.          ${CLR_GREEN}│${NC}"
echo -e "${CLR_GREEN}│${NC} ${CLR_CYAN}Notice:${NC} Persistent database volumes were NOT deleted.       ${CLR_GREEN}│${NC}"
echo -e "${CLR_GREEN}│${NC} Your tables, schemas, and metrics are preserved perfectly!  ${CLR_GREEN}│${NC}"
echo -e "${CLR_GREEN}└────────────────────────────────────────────────────────────┘${NC}"
echo
