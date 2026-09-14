#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Arch-Systems — Cloudflare Tunnel & Edge CDN Deployment Orchestrator
# ─────────────────────────────────────────────────────────────────────────────
# Exposes Arch-System Next.js Portal and SCADA endpoints securely over your
# custom domain via Cloudflare Edge CDN & Cloudflare Tunnels (cloudflared).
#
# Uses: scripts/lib/common.sh
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
LOG_LABEL="[cloudflare]"

ENV_FILE="$PORTAL_DIR/.env"
ENV_BAK="$PORTAL_DIR/.env.bak"
PORT="${PORT:-3000}"
TUNNEL_CONFIG="$REPO_ROOT/infra/cloudflared/production-tunnel.yml.example"

# ── Cleanup Trap ─────────────────────────────────────────────────────────────
cleanup() {
  trap - EXIT INT TERM
  info "Cleaning up background processes..."
  for pidfile in .portal.pid .cloudflared.pid; do
    if [ -f "$RUN_DIR/$pidfile" ]; then
      local pid
      pid=$(cat "$RUN_DIR/$pidfile" 2>/dev/null || true)
      if [ -n "$pid" ] && pid_running "$pid"; then
        kill -TERM "$pid" 2>/dev/null || true
      fi
      rm -f "$RUN_DIR/$pidfile"
    fi
  done
}
# Only register trap if executed directly and user interrupts
trap cleanup INT TERM

echo -e "\n${CYAN}┌────────────────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}│       ARCH-SYSTEMS — CLOUDFLARE TUNNEL & EDGE ORCHESTRATOR │${NC}"
echo -e "${CYAN}├────────────────────────────────────────────────────────────┤${NC}"
echo -e "${CYAN}│${NC} Encrypted Cloudflare Edge CDN hosting for domain access.   ${CYAN}│${NC}"
echo -e "${CYAN}│${NC} Connects Arch-System + Arch-Base over Cloudflare WAF.      ${CYAN}│${NC}"
echo -e "${CYAN}└────────────────────────────────────────────────────────────┘${NC}\n"

# ── Step 1: Verify Cloudflared Binary ─────────────────────────────────────
info "Checking Cloudflare Tunnel daemon (cloudflared)..."
if ! command -v cloudflared >/dev/null 2>&1; then
  fatal "cloudflared is not installed on this system. Install via: pacman -S cloudflared (or yay -S cloudflared)"
fi

CF_VERSION=$(cloudflared --version 2>&1 | head -n 1)
info "Cloudflared version: ${CYAN}${BOLD}$CF_VERSION${NC}"

# ── Step 2: Choose Operation Mode ─────────────────────────────────────────
echo -e "\n${WHITE}Choose serving mode:${NC}"
echo -e "  [1] ${GREEN}${BOLD}Development Mode${NC} (TryCloudflare ad-hoc HTTPS tunnel: instant hot-reload)"
echo -e "  [2] ${BLUE}${BOLD}Production Mode${NC}  (Precompiled standalone server via Production Tunnel config)"

if [ -t 0 ]; then
  read -p "Select mode [1/2] (Default: 1): " mode_choice
  mode_choice=${mode_choice:-1}
else
  mode_choice="${CF_MODE:-1}"
fi

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
    anon_key=$(get_env_var "$ENV_FILE" "NEXT_PUBLIC_SUPABASE_ANON_KEY")
    service_key=$(get_env_var "$ENV_FILE" "SUPABASE_SERVICE_KEY")
  fi
fi

# ── Step 4: Clear Port & Launch Portal ─────────────────────────────────────
if is_port_in_use "$PORT"; then
  info "Freeing port $PORT..."
  kill_port "$PORT" 9
fi

mkdir -p "$RUN_DIR"

if [ "$mode_choice" -eq 1 ]; then
  info "Launching in Development Mode (Hot-Reloading active)..."
  cd "$PORTAL_DIR"
  HOSTNAME=0.0.0.0 PORT=$PORT pnpm dev > "$RUN_DIR/portal.log" 2>&1 &
  echo $! > "$RUN_DIR/.portal.pid"
else
  info "Building production standalone bundle..."
  cd "$REPO_ROOT"
  pnpm --filter portal build

  info "Launching Production Standalone server..."
  cd "$PORTAL_DIR"
  HOSTNAME=0.0.0.0 PORT=$PORT node .next/standalone/apps/portal/server.js > "$RUN_DIR/portal.log" 2>&1 &
  echo $! > "$RUN_DIR/.portal.pid"
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
  warn "Portal started, but /api/health did not return 200 within 60s. Check: tail -n 20 $RUN_DIR/portal.log"
else
  log "Portal health check verified (200 OK)."
fi

# ── Step 7: Configure Cloudflare Tunnel (HTTPS) ───────────────────────────
info "Configuring Cloudflare Tunnel reverse proxy..."

if [ "$mode_choice" -eq 1 ]; then
  info "Starting TryCloudflare ad-hoc tunnel for http://localhost:$PORT..."
  cloudflared tunnel --url "http://localhost:$PORT" --no-autoupdate > "$RUN_DIR/cloudflared.log" 2>&1 &
  echo $! > "$RUN_DIR/.cloudflared.pid"

  CF_URL=""
  for i in {1..15}; do
    CF_URL=$(grep -o 'https://[-0-9a-z]*\.trycloudflare\.com' "$RUN_DIR/cloudflared.log" 2>/dev/null | head -n 1 || true)
    if [ -n "$CF_URL" ]; then break; fi
    sleep 1
  done

  if [ -n "$CF_URL" ]; then
    log "TryCloudflare tunnel active: ${CYAN}${BOLD}$CF_URL${NC}"
  else
    warn "Tunnel started, check logs at $RUN_DIR/cloudflared.log"
  fi
else
  info "Validating production Cloudflare Tunnel configuration..."
  cloudflared tunnel --config "$TUNNEL_CONFIG" ingress validate
  info "Starting named production Cloudflare Tunnel..."
  cloudflared tunnel --config "$TUNNEL_CONFIG" run > "$RUN_DIR/cloudflared.log" 2>&1 &
  echo $! > "$RUN_DIR/.cloudflared.pid"
  log "Production Cloudflare Tunnel process started."
fi

# ── Step 8: Deployment Summary ────────────────────────────────────────────
echo -e "\n${GREEN}┌────────────────────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}│       ARCH-SYSTEMS IS NOW SERVING VIA CLOUDFLARE TUNNEL    │${NC}"
echo -e "${GREEN}├────────────────────────────────────────────────────────────┤${NC}"
if [ -n "${CF_URL:-}" ]; then
echo -e "${GREEN}│${NC} ${BOLD}Public Cloudflare HTTPS URL:${NC}                              ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} ${CYAN}${BOLD}${CF_URL}${NC}             ${GREEN}│${NC}"
echo -e "${GREEN}│${NC}                                                            ${GREEN}│${NC}"
fi
echo -e "${GREEN}│${NC} ${BOLD}Local Portal Endpoint:${NC}                                    ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} ${CYAN}${BOLD}http://localhost:${PORT}${NC}                                     ${GREEN}│${NC}"
echo -e "${GREEN}│${NC}                                                            ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} ${WHITE}Supabase API:${NC}       http://localhost:54321                    ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} ${WHITE}Supabase Studio:${NC}    http://localhost:54323                    ${GREEN}│${NC}"
echo -e "${GREEN}├────────────────────────────────────────────────────────────┤${NC}"
if [ "$mode_choice" -eq 1 ]; then
echo -e "${GREEN}│${NC} ${YELLOW}Mode:${NC} ${BOLD}Development (TryCloudflare Tunnel + Hot Reload)${NC}       ${GREEN}│${NC}"
else
echo -e "${GREEN}│${NC} ${BLUE}Mode:${NC} ${BOLD}Production Standalone (Named Cloudflare Tunnel)${NC}       ${GREEN}│${NC}"
fi
echo -e "${GREEN}│${NC}                                                            ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} To halt stack: ${YELLOW}./scripts/shutdown.sh${NC}                       ${GREEN}│${NC}"
echo -e "${GREEN}└────────────────────────────────────────────────────────────┘${NC}\n"

log "Cloudflare deployment sequence completed successfully."

# --- Arch-CorpOS Business Loop Trigger ---
log "Triggering Post-Deployment Self-Improving Validation..."
if [ -x "$REPO_ROOT/.agents/corpos/bin/corpos" ]; then
  "$REPO_ROOT/.agents/corpos/bin/corpos" tick deployment-learning-loop || true
else
  log "CorpOS binary not found, skipping autonomous validation."
fi

