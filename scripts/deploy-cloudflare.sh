#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Arch-Systems — Cloudflare Tunnel & Edge CDN Deployment Orchestrator
# ─────────────────────────────────────────────────────────────────────────────
# Exposes Arch-System Next.js Portal and SCADA endpoints securely over your
# custom domain via Cloudflare Edge CDN & Cloudflare Tunnels (cloudflared).
#
# Features:
# - Automatic cloudflared status & ingress verification
# - Choice of Development (TryCloudflare ad-hoc tunnel) or Production (Named Tunnel)
# - Automatic Supabase Docker stack orchestration (Arch-Base / Arch-System)
# - Automatic HTTPS termination & DDoS protection via Cloudflare Edge WAF
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
TUNNEL_CONFIG="$REPO_ROOT/infra/cloudflared/production-tunnel.yml.example"

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

log() { echo -e "${CLR_GREEN}[cloudflare-host]${CLR_RESET} $*"; }
info() { echo -e "${CLR_BLUE}[info]${CLR_RESET} $*"; }
warn() { echo -e "${CLR_YELLOW}[warn]${CLR_RESET} $*"; }
error() { echo -e "${CLR_RED}[error]${CLR_RESET} $*"; }
fatal() { error "$*"; exit 1; }

echo -e "\n${CLR_CYAN}┌────────────────────────────────────────────────────────────┐${CLR_RESET}"
echo -e "${CLR_CYAN}│       ARCH-SYSTEMS — CLOUDFLARE TUNNEL & EDGE ORCHESTRATOR │${CLR_RESET}"
echo -e "${CLR_CYAN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
echo -e "${CLR_CYAN}│${CLR_RESET} Encrypted Cloudflare Edge CDN hosting for domain access.   ${CLR_CYAN}│${CLR_RESET}"
echo -e "${CLR_CYAN}│${CLR_RESET} Connects Arch-System + Arch-Base over Cloudflare WAF.      ${CLR_CYAN}│${CLR_RESET}"
echo -e "${CLR_CYAN}└────────────────────────────────────────────────────────────┘${CLR_RESET}\n"

# ── Step 1: Verify Cloudflared Binary ─────────────────────────────────────
info "Checking Cloudflare Tunnel daemon (cloudflared)..."
if ! command -v cloudflared >/dev/null 2>&1; then
  fatal "cloudflared is not installed on this system. Install via: pacman -S cloudflared"
fi

CF_VERSION=$(cloudflared --version 2>&1 | head -n 1)
info "Cloudflared version: ${CLR_CYAN}${CLR_BOLD}$CF_VERSION${CLR_RESET}"

# ── Step 2: Choose Operation Mode ─────────────────────────────────────────
echo -e "\n${CLR_WHITE}Choose serving mode:${CLR_RESET}"
echo -e "  [1] ${CLR_GREEN}${CLR_BOLD}Development Mode${CLR_RESET} (TryCloudflare ad-hoc HTTPS tunnel: instant hot-reload)"
echo -e "  [2] ${CLR_BLUE}${CLR_BOLD}Production Mode${CLR_RESET}  (Precompiled standalone server via Production Tunnel config)"
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

# ── Step 4: Clear Port & Launch Portal ─────────────────────────────────────
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

# ── Step 5: Start Arch-Base Web App ───────────────────────────────────────
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

# ── Step 7: Configure Cloudflare Tunnel (HTTPS) ───────────────────────────
info "Configuring Cloudflare Tunnel reverse proxy..."

if [ "$mode_choice" -eq 1 ]; then
  info "Starting TryCloudflare ad-hoc tunnel for http://localhost:$PORT..."
  cloudflared tunnel --url "http://localhost:$PORT" --no-autoupdate > "$REPO_ROOT/run/cloudflared.log" 2>&1 &
  echo $! > "$REPO_ROOT/run/.cloudflared.pid"

  CF_URL=""
  for i in {1..15}; do
    CF_URL=$(grep -o 'https://[-0-9a-z]*\.trycloudflare\.com' "$REPO_ROOT/run/cloudflared.log" | head -n 1 || true)
    if [ -n "$CF_URL" ]; then break; fi
    sleep 1
  done

  if [ -n "$CF_URL" ]; then
    log "TryCloudflare tunnel active: ${CLR_CYAN}${CLR_BOLD}$CF_URL${CLR_RESET}"
  else
    warn "Tunnel started, check logs at $REPO_ROOT/run/cloudflared.log"
  fi
else
  info "Validating production Cloudflare Tunnel configuration..."
  cloudflared tunnel --config "$TUNNEL_CONFIG" ingress validate
  info "Starting named production Cloudflare Tunnel..."
  cloudflared tunnel --config "$TUNNEL_CONFIG" run > "$REPO_ROOT/run/cloudflared.log" 2>&1 &
  echo $! > "$REPO_ROOT/run/.cloudflared.pid"
  log "Production Cloudflare Tunnel process started."
fi

# ── Step 8: Deployment Summary ────────────────────────────────────────────
echo -e "\n${CLR_GREEN}┌────────────────────────────────────────────────────────────┐${CLR_RESET}"
echo -e "${CLR_GREEN}│       ARCH-SYSTEMS IS NOW SERVING VIA CLOUDFLARE TUNNEL    │${CLR_RESET}"
echo -e "${CLR_GREEN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
if [ -n "${CF_URL:-}" ]; then
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_BOLD}Public Cloudflare HTTPS URL:${CLR_RESET}                              ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_CYAN}${CLR_BOLD}${CF_URL}${CLR_RESET}             ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET}                                                            ${CLR_GREEN}│${CLR_RESET}"
fi
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_BOLD}Local Portal Endpoint:${CLR_RESET}                                    ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_CYAN}${CLR_BOLD}http://localhost:${PORT}${CLR_RESET}                                     ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET}                                                            ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_WHITE}Supabase API:${CLR_RESET}       http://localhost:54321                    ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_WHITE}Supabase Studio:${CLR_RESET}    http://localhost:54323                    ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
if [ "$mode_choice" -eq 1 ]; then
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_YELLOW}Mode:${CLR_RESET} ${CLR_BOLD}Development (TryCloudflare Tunnel + Hot Reload)${CLR_RESET}       ${CLR_GREEN}│${CLR_RESET}"
else
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_BLUE}Mode:${CLR_RESET} ${CLR_BOLD}Production Standalone (Named Cloudflare Tunnel)${CLR_RESET}       ${CLR_GREEN}│${CLR_RESET}"
fi
echo -e "${CLR_GREEN}│${CLR_RESET}                                                            ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} To halt stack: ${CLR_YELLOW}./scripts/shutdown.sh${CLR_RESET}                       ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}└────────────────────────────────────────────────────────────┘${CLR_RESET}\n"

log "Cloudflare deployment sequence completed successfully."
