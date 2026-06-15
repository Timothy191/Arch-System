#!/usr/bin/env bash
set -euo pipefail

# Arch-Systems — Live Local Network Deployment Script
# Use this script to turn this system into a server on your local Wi-Fi / network.
# Other devices on the same network can access the portal via http://<server-ip>:3000.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL_DIR="$REPO_ROOT/apps/portal"
DATABASE_DIR="$REPO_ROOT/packages/database"
SUPABASE_DIR="$REPO_ROOT/packages/supabase"
ENV_FILE="$PORTAL_DIR/.env"
ENV_BAK="$PORTAL_DIR/.env.bak"
PORT="${PORT:-3000}"

# Colors
CLR_RESET="\033[0m"
CLR_RED="\033[0;31m"
CLR_GREEN="\033[0;32m"
CLR_YELLOW="\033[0;33m"
CLR_BLUE="\033[0;34m"
CLR_MAGENTA="\033[0;35m"
CLR_CYAN="\033[0;36m"
CLR_WHITE="\033[0;37m"
CLR_BOLD="\033[1m"

log() { echo -e "${CLR_GREEN}[deploy-live]${CLR_RESET} $*"; }
info() { echo -e "${CLR_BLUE}[info]${CLR_RESET} $*"; }
warn() { echo -e "${CLR_YELLOW}[warn]${CLR_RESET} $*"; }
error() { echo -e "${CLR_RED}[error]${CLR_RESET} $*"; }
fatal() { error "$*"; exit 1; }

# Banner
echo -e "\n${CLR_CYAN}┌────────────────────────────────────────────────────────────┐${CLR_RESET}"
echo -e "${CLR_CYAN}│          ARCH-SYSTEMS — LIVE LOCAL NETWORK DEPLOYMENT      │${CLR_RESET}"
echo -e "${CLR_CYAN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
echo -e "${CLR_CYAN}│${CLR_RESET} Configures this machine as a local network server.         ${CLR_CYAN}│${CLR_RESET}"
echo -e "${CLR_CYAN}│${CLR_RESET} Allows login from other devices on the same Wi-Fi/LAN.     ${CLR_CYAN}│${CLR_RESET}"
echo -e "${CLR_CYAN}└────────────────────────────────────────────────────────────┘${CLR_RESET}\n"

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
echo -e "${CLR_WHITE}Detected primary network IP:${CLR_RESET} ${CLR_CYAN}${CLR_BOLD}$default_ip${CLR_RESET}"
if [ ${#filtered_ips[@]} -gt 1 ]; then
  echo -e "${CLR_YELLOW}Multiple local IPs found:${CLR_RESET}"
  for idx in "${!filtered_ips[@]}"; do
    echo -e "  [$((idx+1))] ${filtered_ips[$idx]}"
  done
fi

read -p "Use IP '$default_ip' for network access? [Y/n]: " confirm_ip
confirm_ip=${confirm_ip:-Y}

selected_ip="$default_ip"
if [[ "$confirm_ip" =~ ^[nN] ]]; then
  read -p "Enter the custom IP address to use: " selected_ip
  if [ -z "$selected_ip" ]; then
    fatal "IP address cannot be empty."
  fi
fi

info "Selected IP address: ${CLR_CYAN}$selected_ip${CLR_RESET}"

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

# Determine compose command
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
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
  pnpx supabase start
fi

info "Retrieving local database access credentials..."
status_out=$(pnpx supabase status || true)
anon_key=$(echo "$status_out" | grep "anon key:" | awk '{print $3}' || true)
service_key=$(echo "$status_out" | grep "service_role key:" | awk '{print $3}' || true)

if [ -z "$anon_key" ] || [ -z "$service_key" ]; then
  # Fallback to reading existing .env if present
  if [ -f "$ENV_FILE" ]; then
    anon_key=$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d ' "' || true)
    service_key=$(grep -E '^SUPABASE_SERVICE_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d ' "' || true)
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

python3 "$REPO_ROOT/scripts/ensure_reachability.py" "$selected_ip" "$anon_key" "$service_key"

# ── Step 5: Clean and Build Portal ───────────────────────────
cd "$REPO_ROOT"
info "Cleaning cache and compiling production bundle (this takes ~1-2 min)..."
rm -rf "$PORTAL_DIR/.next"

pnpm install --frozen-lockfile
pnpm turbo build --filter=portal...

# ── Step 6: Start Secondary Tools ────────────────────────────
info "Starting secondary tools..."
if [ -f "$REPO_ROOT/docker-compose.tools.yml" ]; then
  $COMPOSE_CMD -f "$REPO_ROOT/docker-compose.tools.yml" up -d
fi

if [ -f "$REPO_ROOT/docker-compose.monitoring.yml" ]; then
  $COMPOSE_CMD -f "$REPO_ROOT/docker-compose.monitoring.yml" up -d
fi

# ── Step 7: Launch Server ────────────────────────────────────
info "Starting Next.js server bound to 0.0.0.0..."
# Clear any process on port 3000
stray_pids=$(ss -tunlp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K\d+' | sort -u || true)
if [ -n "$stray_pids" ]; then
  info "Clearing port $PORT..."
  echo "$stray_pids" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

cd "$PORTAL_DIR"
HOSTNAME=0.0.0.0 PORT=$PORT pnpm start > "$REPO_ROOT/portal.log" 2>&1 &
echo $! > "$REPO_ROOT/.portal.pid"

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
  fatal "Server failed to start. View logs in portal.log"
fi

# ── Step 8: Success Dashboard ───────────────────────────────
echo -e "\n${CLR_GREEN}┌────────────────────────────────────────────────────────────┐${CLR_RESET}"
echo -e "${CLR_GREEN}│          ARCH-SYSTEMS LOCAL SERVER IS NOW LIVE             │${CLR_RESET}"
echo -e "${CLR_GREEN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} Server IP: ${CLR_CYAN}${selected_ip}${CLR_RESET}                                      ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} Server Port: ${CLR_CYAN}${PORT}${CLR_RESET}                                        ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_BOLD}Network Access URL for Employees:${CLR_RESET}                         ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_CYAN}${CLR_BOLD}http://${selected_ip}:${PORT}${CLR_RESET}                                 ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET}                                                            ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_WHITE}Notes:${CLR_RESET}                                                      ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} 1. Employees MUST be connected to the same Wi-Fi/LAN.      ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} 2. Do not close this terminal or shut down this host.       ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} 3. To stop, run: ${CLR_YELLOW}kill \$(cat .portal.pid)${CLR_RESET}                   ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET}    and ${CLR_YELLOW}pnpm --filter @repo/database supabase:stop${CLR_RESET}         ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} ${CLR_WHITE}QR Code Link for mobile login:${CLR_RESET}                              ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}│${CLR_RESET} https://api.qrserver.com/v1/create-qr-code/?data=http://${selected_ip}:${PORT} ${CLR_GREEN}│${CLR_RESET}"
echo -e "${CLR_GREEN}└────────────────────────────────────────────────────────────┘${CLR_RESET}\n"

log "System successfully exposed to local network."
