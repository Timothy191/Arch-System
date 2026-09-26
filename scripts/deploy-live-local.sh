#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# Arch-Systems — Live Local Network Deployment Script
# Configures this machine as a local network server.
# Allows access from other devices on the same Wi-Fi / LAN.
# Uses: scripts/lib/common.sh
# ──────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
LOG_LABEL="[deploy-live]"

ENV_FILE="$PORTAL_DIR/.env"
ENV_BAK="$PORTAL_DIR/.env.bak"
PORT="${PORT:-3000}"

# Banner
echo -e "\n${CYAN}┌────────────────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}│          ARCH-SYSTEMS — LIVE LOCAL NETWORK DEPLOYMENT      │${NC}"
echo -e "${CYAN}├────────────────────────────────────────────────────────────┤${NC}"
echo -e "${CYAN}│${NC} Configures this machine as a local network server.         ${CYAN}│${NC}"
echo -e "${CYAN}│${NC} Allows login from other devices on the same Wi-Fi/LAN.     ${CYAN}│${NC}"
echo -e "${CYAN}└────────────────────────────────────────────────────────────┘${NC}\n"

# ── Step 1: Detect Network IP ──────────────────────────────
info "Detecting local network IP address..."
ips=($(hostname -I 2>/dev/null || ip addr show | grep -oE 'inet [0-9.]+' | cut -d' ' -f2 || echo ""))

# Filter out loopback (127.x.x.x) and common Docker bridge subnets (172.x.x.x)
filtered_ips=()
default_ip=""
for ip in "${ips[@]}"; do
  if [[ ! "$ip" =~ ^127\. ]] && [[ ! "$ip" =~ ^172\.1[789]\. ]] && [[ ! "$ip" =~ ^172\.2[0-9]\. ]] && [[ ! "$ip" =~ ^172\.3[01]\. ]] && [[ -n "$ip" ]]; then
    filtered_ips+=("$ip")
  fi
done

# Try default route lookup as well
route_ip=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[0-9.]+' || true)
if [[ -n "$route_ip" ]]; then
  default_ip="$route_ip"
else
  if [ ${#filtered_ips[@]} -gt 0 ]; then
    default_ip="${filtered_ips[0]}"
  fi
fi

if [ -z "$default_ip" ]; then
  fatal "No active local network IP address detected. Please connect to a Wi-Fi or ethernet network."
fi

# Let user confirm or change the IP
echo -e "${WHITE}Detected primary network IP:${NC} ${CYAN}${BOLD}$default_ip${NC}"
if [ ${#filtered_ips[@]} -gt 1 ]; then
  echo -e "${YELLOW}Multiple local IPs found:${NC}"
  for idx in "${!filtered_ips[@]}"; do
    echo -e "  [$((idx+1))] ${filtered_ips[$idx]}"
  done
fi

if [ -t 0 ]; then
  read -p "Use IP '$default_ip' for network access? [Y/n]: " confirm_ip
  confirm_ip=${confirm_ip:-Y}
else
  confirm_ip="Y"
fi

selected_ip="$default_ip"
if [[ "$confirm_ip" =~ ^[nN] ]]; then
  if [ -t 0 ]; then
    read -p "Enter the custom IP address to use: " selected_ip
  fi
  if [ -z "$selected_ip" ]; then
    fatal "IP address cannot be empty."
  fi
fi

info "Selected IP address: ${CYAN}$selected_ip${NC}"

# ── Step 2: Validate Prerequisites ──────────────────────────
info "Checking prerequisites..."
if ! command -v node >/dev/null 2>&1; then
  fatal "Node.js not installed."
fi
if ! command -v pnpm >/dev/null 2>&1; then
  fatal "pnpm not installed."
fi
if ! docker info >/dev/null 2>&1; then
  fatal "Docker is not running."
fi

# ── Step 3: Run Database & Grab Keys ────────────────────────
info "Starting local database stack..."
# Ensure migrations are in place
mkdir -p "$SUPABASE_DIR/supabase/migrations"
cp -r "$DATABASE_DIR/migrations/"* "$SUPABASE_DIR/supabase/migrations/" 2>/dev/null || true

cd "$DATABASE_DIR"
if docker ps --format '{{.Names}}' | grep -q 'supabase_'; then
  info "Supabase containers already running."
else
  npx supabase start
fi

info "Retrieving local database access credentials..."
status_out=$(npx supabase status 2>/dev/null || true)
anon_key=$(echo "$status_out" | grep "anon key:" | awk '{print $3}' || true)
service_key=$(echo "$status_out" | grep "service_role key:" | awk '{print $3}' || true)

if [ -z "$anon_key" ] || [ -z "$service_key" ]; then
  # Fallback to reading existing .env if present
  if [ -f "$ENV_FILE" ]; then
    anon_key=$(get_env_var "$ENV_FILE" "NEXT_PUBLIC_SUPABASE_ANON_KEY")
    service_key=$(get_env_var "$ENV_FILE" "SUPABASE_SERVICE_KEY")
  fi
fi

if [ -z "$anon_key" ] || [ -z "$service_key" ]; then
  fatal "Could not retrieve Supabase keys. Please restart Supabase manually."
fi

# ── Step 4: Configure Live Local Env variables ───────────────
info "Updating environment variables..."
if [ ! -f "$ENV_FILE" ]; then
  info "Seeding apps/portal/.env from apps/portal/.env.example..."
  cp "$PORTAL_DIR/.env.example" "$ENV_FILE"
fi
if [ ! -f "$REPO_ROOT/.env" ]; then
  info "Seeding root .env from apps/portal/.env.example..."
  cp "$PORTAL_DIR/.env.example" "$REPO_ROOT/.env"
fi

if [ -f "$REPO_ROOT/scripts/ensure_reachability.py" ]; then
  python3 "$REPO_ROOT/scripts/ensure_reachability.py" "$selected_ip" "$anon_key" "$service_key"
fi

# ── Step 5: Clean and Build Portal ───────────────────────────
cd "$REPO_ROOT"
info "Cleaning cache and compiling production bundle (this takes ~1-2 min)..."
rm -rf "$PORTAL_DIR/.next"

pnpm install --frozen-lockfile
pnpm --filter portal build

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
    # Wait for it to become healthy
    for i in {1..30}; do
      if curl -fs "http://localhost:3001" > /dev/null 2>&1; then
        info "Arch-Base web app is healthy"
        break
      fi
      sleep 2
    done
  fi
fi

# ── Step 6: Start Secondary Tools ────────────────────────────
info "Starting secondary tools..."
if [ -f "$REPO_ROOT/infra/docker/compose.tools.yml" ]; then
  $COMPOSE_CMD -f "$REPO_ROOT/infra/docker/compose.tools.yml" up -d >/dev/null 2>&1 || true
fi

if [ -f "$REPO_ROOT/infra/monitoring/docker-compose.yml" ]; then
  $COMPOSE_CMD -f "$REPO_ROOT/infra/monitoring/docker-compose.yml" up -d >/dev/null 2>&1 || true
fi

# ── Step 7: Launch Server ────────────────────────────────────
info "Starting Next.js server bound to 0.0.0.0..."
if is_port_in_use "$PORT"; then
  info "Clearing port $PORT..."
  kill_port "$PORT" 9
fi

cd "$PORTAL_DIR"
HOSTNAME=0.0.0.0 PORT=$PORT pnpm start > "$REPO_ROOT/run/portal.log" 2>&1 &
echo $! > "$REPO_ROOT/run/.portal.pid"

# Wait for server to become healthy
info "Running health checks..."
health_ok=false
for i in {1..30}; do
  if curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    health_ok=true
    break
  fi
  sleep 2
done

if [ "$health_ok" = false ]; then
  fatal "Server failed to start. View logs in run/portal.log"
fi

# ── Step 8: Success Dashboard ───────────────────────────────
echo -e "\n${GREEN}┌────────────────────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}│          ARCH-SYSTEMS LOCAL SERVER IS NOW LIVE             │${NC}"
echo -e "${GREEN}├────────────────────────────────────────────────────────────┤${NC}"
echo -e "${GREEN}│${NC} Server IP: ${CYAN}${selected_ip}${NC}                                      ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} Server Port: ${CYAN}${PORT}${NC}                                        ${GREEN}│${NC}"
echo -e "${GREEN}├────────────────────────────────────────────────────────────┤${NC}"
echo -e "${GREEN}│${NC} ${BOLD}Network Access URL for Employees:${NC}                         ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} ${CYAN}${BOLD}http://${selected_ip}:${PORT}${NC}                                 ${GREEN}│${NC}"
echo -e "${GREEN}│${NC}                                                            ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} ${WHITE}Notes:${NC}                                                      ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} 1. Employees MUST be connected to the same Wi-Fi/LAN.      ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} 2. Do not close this terminal or shut down this host.       ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} 3. To stop, run: ${YELLOW}./scripts/shutdown.sh${NC}                     ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} ${WHITE}QR Code Link for mobile login:${NC}                              ${GREEN}│${NC}"
echo -e "${GREEN}│${NC} https://api.qrserver.com/v1/create-qr-code/?data=http://${selected_ip}:${PORT} ${GREEN}│${NC}"
echo -e "${GREEN}└────────────────────────────────────────────────────────────┘${NC}\n"

log "System successfully exposed to local network."

# --- Arch-CorpOS Business Loop Trigger ---
log "Triggering Post-Deployment Self-Improving Validation..."
if [ -x "$REPO_ROOT/.agents/corpos/bin/corpos" ]; then
  "$REPO_ROOT/.agents/corpos/bin/corpos" tick deployment-learning-loop || true
else
  log "CorpOS binary not found, skipping autonomous validation."
fi

