#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Arch-Systems — Tailscale Deployment & Live Serving Orchestrator
# ─────────────────────────────────────────────────────────────────────────────
# Turns this Linux workstation into an encrypted, private, high-performance
# operations server accessible across your Tailscale mesh network (Tailnet).
#
# Features:
# - Automatic Tailscale status & IP/MagicDNS detection
# - Instant Hot-Reload (Dev Mode) or Standalone (Production Mode)
# - Automatic Supabase Docker stack orchestration (Arch-Base / Arch-System)
# - Environment reachability configuration for mobile & remote tablets
# - Automatic HTTPS termination via Tailscale Serve
# ─────────────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL_DIR="$REPO_ROOT/apps/portal"
ARCH_BASE_DIR="${ARCH_BASE_DIR:-$(cd "$REPO_ROOT/../Arch-Base" 2>/dev/null && pwd || true)}"

if [ -d "$ARCH_BASE_DIR" ] && [ -f "$ARCH_BASE_DIR/supabase/config.toml" ]; then
  DATABASE_DIR="$ARCH_BASE_DIR"
  SUPABASE_DIR="$ARCH_BASE_DIR/supabase"
  ARCH_BASE_WEB_DIR="$ARCH_BASE_DIR/apps/web"
else
  DATABASE_DIR="$REPO_ROOT/packages/database"
  SUPABASE_DIR="$REPO_ROOT/packages/supabase"
  ARCH_BASE_WEB_DIR=""
fi

ENV_FILE="$PORTAL_DIR/.env"
ENV_BAK="$PORTAL_DIR/.env.bak"
PORT="${PORT:-3000}"

# ANSI Colors
CLR_RESET="\033[0m"
CLR_RED="\033[0;31m"
CLR_GREEN="\033[0;32m"
CLR_YELLOW="\033[0;33m"
CLR_BLUE="\033[0;34m"
CLR_MAGENTA="\033[0;35m"
CLR_CYAN="\033[0;36m"
CLR_WHITE="\033[0;37m"
CLR_BOLD="\033[1m"

log() { echo -e "${CLR_GREEN}[tailscale-host]${CLR_RESET} $*"; }
info() { echo -e "${CLR_BLUE}[info]${CLR_RESET} $*"; }
warn() { echo -e "${CLR_YELLOW}[warn]${CLR_RESET} $*"; }
error() { echo -e "${CLR_RED}[error]${CLR_RESET} $*"; }
fatal() { error "$*"; exit 1; }

echo -e "\n${CLR_CYAN}┌────────────────────────────────────────────────────────────┐${CLR_RESET}"
echo -e "${CLR_CYAN}│          ARCH-SYSTEMS — TAILSCALE SERVE ORCHESTRATOR       │${CLR_RESET}"
echo -e "${CLR_CYAN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
echo -e "${CLR_CYAN}│${CLR_RESET} Secure, Zero-Trust WireGuard hosting for mobile & desktop. ${CLR_CYAN}│${CLR_RESET}"
echo -e "${CLR_CYAN}│${CLR_RESET} Connects Arch-System + Arch-Base over your private Tailnet. ${CLR_CYAN}│${CLR_RESET}"
echo -e "${CLR_CYAN}└────────────────────────────────────────────────────────────┘${CLR_RESET}\n"

# ── Step 1: Verify Tailscale Daemon & Network ─────────────────────────────
info "Checking Tailscale installation..."
if ! command -v tailscale >/dev/null 2>&1; then
  fatal "Tailscale is not installed on this system. Install via: pacman -S tailscale"
fi

# Check if tailscaled is active
if ! systemctl is-active --quiet tailscaled 2>/dev/null; then
  warn "The Tailscale background daemon (tailscaled) is not running."
  echo -e "Starting tailscaled via sudo..."
  sudo systemctl start tailscaled || fatal "Failed to start tailscaled. Run: sudo systemctl start tailscaled"
fi

# Check Tailscale login status
tailscale_status=$(tailscale status 2>&1 || true)
if echo "$tailscale_status" | grep -q "Logged out"; then
  warn "Tailscale is logged out. Please authenticate:"
  tailscale up
fi

TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")
if [ -z "$TAILSCALE_IP" ]; then
  fatal "Could not determine Tailscale IPv4 address. Is Tailscale connected? (Run: tailscale up)"
fi

# Determine MagicDNS domain if available
MAGIC_DNS=$(tailscale status --json 2>/dev/null | grep -oP '"Self":\s*\{\s*"DNSName":\s*"\K[^"]+' | sed 's/\.$//' || true)

info "Tailscale IPv4 detected: ${CLR_CYAN}${CLR_BOLD}$TAILSCALE_IP${CLR_RESET}"
if [ -n "$MAGIC_DNS" ]; then
  info "Tailscale MagicDNS detected: ${CLR_CYAN}${CLR_BOLD}$MAGIC_DNS${CLR_RESET}"
fi

# ── Step 2: Choose Operation Mode ─────────────────────────────────────────
echo -e "\n${CLR_WHITE}Choose serving mode:${CLR_RESET}"
echo -e "  [1] ${CLR_GREEN}${CLR_BOLD}Development Mode${CLR_RESET} (Instant Hot-Reload: edits to code reflect live on devices)"
echo -e "  [2] ${CLR_BLUE}${CLR_BOLD}Production Mode${CLR_RESET}  (Precompiled, standalone Node.js server for maximum speed)"
read -p "Select mode [1/2] (Default: 1): " mode_choice
mode_choice=${mode_choice:-1}

# ── Step 3: Check and Launch Database (Supabase) ──────────────────────────
info "Checking local Supabase database..."
if ! command -v docker >/dev/null 2>&1; then
  fatal "Docker is required to run the local Supabase stack."
fi

if ! docker info >/dev/null 2>&1; then
  fatal "Docker daemon is not running. Please start Docker (sudo systemctl start docker)."
fi

cd "$DATABASE_DIR"
if docker ps --format '{{.Names}}' | grep -q 'supabase_'; then
  info "Supabase containers are already running."
else
  info "Starting Supabase Docker stack..."
  pnpm supabase:start || pnpm --filter @repo/supabase supabase:start || true
fi

# Grab Supabase keys
info "Retrieving Supabase connection keys..."
status_out=$(pnpm supabase status 2>/dev/null || pnpm --filter @repo/supabase supabase:status 2>/dev/null || true)
anon_key=$(echo "$status_out" | grep "anon key:" | awk '{print $3}' || true)
service_key=$(echo "$status_out" | grep "service_role key:" | awk '{print $3}' || true)

if [ -z "$anon_key" ] || [ -z "$service_key" ]; then
  if [ -f "$ENV_FILE" ]; then
    anon_key=$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d ' "' || true)
    service_key=$(grep -E '^SUPABASE_SERVICE_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d ' "' || true)
  fi
fi

# ── Step 4: Configure Reachability for Tailnet ────────────────────────────
info "Configuring portal environment for Tailscale IP: $TAILSCALE_IP..."
python3 "$REPO_ROOT/scripts/ensure_reachability.py" "$TAILSCALE_IP" "$anon_key" "$service_key"

# ── Step 5: Clear Port & Launch Portal ─────────────────────────────────────
# Kill any existing process on port 3000
stray_pids=$(ss -tunlp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K\d+' | sort -u || true)
if [ -n "$stray_pids" ]; then
  info "Freeing port $PORT..."
  echo "$stray_pids" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

mkdir -p "$REPO_ROOT/run"

if [ "$mode_choice" -eq 1 ]; then
  info "Launching in Development Mode (Hot-Reloading active)..."
  cd "$PORTAL_DIR"
  HOSTNAME=0.0.0.0 PORT=$PORT pnpm dev > "$REPO_ROOT/run/portal.log" 2>&1 &
  echo $! > "$REPO_ROOT/run/.portal.pid"
else
  info "Building production standalone bundle..."
  cd "$REPO_ROOT"
  pnpm --filter portal build

  info "Launching Production Standalone server..."
  cd "$PORTAL_DIR"
  HOSTNAME=0.0.0.0 PORT=$PORT node .next/standalone/apps/portal/server.js > "$REPO_ROOT/run/portal.log" 2>&1 &
  echo $! > "$REPO_ROOT/run/.portal.pid"
fi

# ── Step 5b: Start Arch-Base Web App ─────────────────────────
if [ -n "$ARCH_BASE_WEB_DIR" ] && [ -d "$ARCH_BASE_WEB_DIR" ]; then
  if curl -fs "http://localhost:3001" > /dev/null 2>&1; then
    info "Arch-Base web app already running on port 3001."
  else
    info "Starting Arch-Base web app on port 3001..."
    cd "$ARCH_BASE_DIR"
    pnpm --filter web dev > "$ARCH_BASE_DIR/.arch-base-web.log" 2>&1 &
    echo $! > "$ARCH_BASE_DIR/.arch-base-web.pid"
    cd "$REPO_ROOT"
    for i in {1..30}; do
      if curl -fs "http://localhost:3001" > /dev/null 2>&1; then
        info "Arch-Base web app is healthy"
        break
      fi
      sleep 2
    done
  fi
fi

# ── Step 6: Health Check ──────────────────────────────────────────────────
info "Waiting for portal to become healthy..."
health_ok=false
for i in {1..30}; do
  if curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    health_ok=true
    break
  fi
  sleep 2
done

if [ "$health_ok" = false ]; then
  warn "Portal started, but /api/health did not return 200 within 60s. Check: tail -n 20 $REPO_ROOT/run/portal.log"
else
  log "Portal health check verified (200 OK)."
fi

# ── Step 7: Configure Tailscale Serve (HTTPS) ──────────────────────────────
info "Configuring Tailscale Serve reverse proxy..."
if tailscale serve --bg "$PORT" >/dev/null 2>&1; then
  log "Tailscale Serve activated on port $PORT with automatic HTTPS."
else
  warn "Could not configure 'tailscale serve' (may require 'sudo tailscale serve' or admin rights)."
  info "Direct HTTP access via Tailscale IP is still fully functional."
fi

# ── Step 8: Deployment Summary ────────────────────────────────────────────
echo -e "\n${CLR_GREEN}┌────────────────────────────────────────────────────────────┐${CLR_RESET}"
echo -e "${CLR_GREEN}│          ARCH-SYSTEMS IS NOW SERVING VIA TAILSCALE        │${CLR_RESET}"
echo -e "${CLR_GREEN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
if [ -n "$MAGIC_DNS" ]; then
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_BOLD}HTTPS Domain (Tailnet):${CLR_RESET}                                    ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_CYAN}${CLR_BOLD}https://${MAGIC_DNS}${CLR_RESET}                                ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET}                                                            ${CLR_GREEN}│${CLR_RESET}"
fi
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_BOLD}Direct Tailscale IP URL:${CLR_RESET}                                   ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_CYAN}${CLR_BOLD}http://${TAILSCALE_IP}:${PORT}${CLR_RESET}                                  ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET}                                                            ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_WHITE}Supabase API:${CLR_RESET}       http://${TAILSCALE_IP}:54321                 ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_WHITE}Supabase Studio:${CLR_RESET}    http://${TAILSCALE_IP}:54323                 ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_WHITE}FUXA SCADA:${CLR_RESET}         http://${TAILSCALE_IP}:1881                  ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
if [ "$mode_choice" -eq 1 ]; then
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_YELLOW}Mode:${CLR_RESET} ${CLR_BOLD}Development (Hot-Reloading ON)${CLR_RESET}                        ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} Code edits saved in editor will update connected devices.   ${CLR_GREEN}│${CLR_RESET}"
else
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_BLUE}Mode:${CLR_RESET} ${CLR_BOLD}Production Standalone${CLR_RESET}                                 ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} Optimized standalone binary running in background.          ${CLR_GREEN}│${CLR_RESET}"
fi
echo -e "${CLR_GREEN}│${CLR_RESET}                                                            ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} To halt stack: ${CLR_YELLOW}./scripts/shutdown.sh${CLR_RESET}                       ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} To stop Tailscale serve: ${CLR_YELLOW}tailscale serve reset${CLR_RESET}             ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}└────────────────────────────────────────────────────────────┘${CLR_RESET}\n"

log "Tailscale deployment sequence completed successfully."

