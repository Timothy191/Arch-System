#!/bin/bash

# Ensure script exits on error
set -e

# Terminal Colors
CLR_RESET='\033[0m'
CLR_RED='\033[0;31m'
CLR_GREEN='\033[0;32m'
CLR_YELLOW='\033[0;33m'
CLR_CYAN='\033[0;36m'
CLR_DIM='\033[2m'
CLR_BOLD='\033[1m'

# Helpers
function info() { echo -e "${CLR_CYAN}ℹ ${1}${CLR_RESET}"; }
function success() { echo -e "${CLR_GREEN}✔ ${1}${CLR_RESET}"; }
function warn() { echo -e "${CLR_YELLOW}⚠ ${1}${CLR_RESET}"; }
function error() { echo -e "${CLR_RED}✖ ${1}${CLR_RESET}"; }

function get_lan_ip() {
  local ip=""
  if command -v ip >/dev/null 2>&1; then
    ip=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -n1)
  elif command -v ifconfig >/dev/null 2>&1; then
    ip=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)
  fi
  echo "${ip:-127.0.0.1}"
}

LAN_IP=$(get_lan_ip)
PORT="${PORT:-3000}"

# Parse command line flags
CLEAN_MODE=false
START_DEV=false
START_PROD=false
START_INFRA=false
BUILD_PROJECT=false

for arg in "$@"; do
  case "$arg" in
    --clean|--reinstall|--fresh) CLEAN_MODE=true ;;
    --dev) START_DEV=true ;;
    --start|--prod|--production) START_PROD=true; BUILD_PROJECT=true ;;
    --infra|--tools) START_INFRA=true ;;
    --build) BUILD_PROJECT=true ;;
    --full)
      CLEAN_MODE=true
      START_INFRA=true
      BUILD_PROJECT=true
      ;;
    --help|-h)
      echo "Arch-Systems One-Click Setup"
      echo "Usage: ./setup.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --full                 Complete end-to-end setup (Clean, Install, Docker Infra, Build)"
      echo "  --clean, --reinstall   Wipe node_modules, cache, and perform clean reinstall"
      echo "  --infra, --tools       Download and start required Docker infrastructure (Redis, Postgres, etc.)"
      echo "  --build                Build the project"
      echo "  --dev                  Complete setup and launch development server"
      echo "  --start, --prod        Complete setup, run production build, and start server"
      echo "  --help, -h             Show this help message"
      exit 0
      ;;
  esac
done

echo
echo -e "${CLR_CYAN}${CLR_BOLD}╔══════════════════════════════════════════════════════════════╗${CLR_RESET}"
echo -e "${CLR_CYAN}${CLR_BOLD}║         ARCH-SYSTEMS — ENTERPRISE PORTAL SETUP               ║${CLR_RESET}"
echo -e "${CLR_CYAN}${CLR_BOLD}╚══════════════════════════════════════════════════════════════╝${CLR_RESET}"
echo

# ── 1. Check Node.js Runtime ──────────────────────────────────────────────────
info "Checking runtime prerequisites..."
if ! command -v node >/dev/null 2>&1; then
  error "Node.js is not installed. Please install Node.js 20+ (recommended 22+) to proceed."
  exit 1
fi

NODE_VERSION=$(node -v | tr -d 'v')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$NODE_MAJOR" -lt 22 ]; then
  error "Detected Node.js v${NODE_VERSION}. Node.js 22+ is required."
  exit 1
else
  success "Node.js v${NODE_VERSION} detected"
fi

# ── 2. Check or Auto-Install pnpm ─────────────────────────────────────────────
if ! command -v pnpm >/dev/null 2>&1; then
  info "pnpm is not found. Attempting to install / enable pnpm automatically..."
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
    corepack prepare pnpm@9.15.9 --activate >/dev/null 2>&1 || true
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    npm install -g pnpm@9.15.9 >/dev/null 2>&1 || {
      error "Could not auto-install pnpm. Please install it with: npm install -g pnpm"
      exit 1
    }
  fi
fi
success "pnpm $(pnpm -v) ready"

# ── 3. Clean / Reinstall (if requested) ───────────────────────────────────────
if [ "$CLEAN_MODE" = true ]; then
  warn "Clean mode enabled — uninstalling and wiping node_modules, build caches, and temporary artifacts..."
  rm -rf node_modules apps/*/node_modules packages/*/node_modules libs/*/*/node_modules
  rm -rf .turbo apps/*/.turbo packages/*/.turbo libs/*/*/.turbo
  rm -rf apps/*/.next
  rm -rf dist apps/*/dist packages/*/dist libs/*/*/dist
  success "Workspace cleaned successfully"
fi

# ── 4. Install Dependencies ───────────────────────────────────────────────────
info "Installing monorepo dependencies with pnpm..."
if [ ! -d "node_modules" ] || [ "$CLEAN_MODE" = true ]; then
  pnpm install
else
  pnpm install --prefer-offline || pnpm install
fi
success "Dependencies installed"

# ── 5. Environment Configuration ──────────────────────────────────────────────
info "Verifying environment configuration..."
PORTAL_ENV="apps/portal/.env"
if [ ! -f "$PORTAL_ENV" ]; then
  if [ -f "apps/portal/env/.env.example" ]; then
    cp "apps/portal/env/.env.example" "$PORTAL_ENV"
    success "Created apps/portal/.env from env/.env.example"
  elif [ -f "apps/portal/.env.example" ]; then
    cp "apps/portal/.env.example" "$PORTAL_ENV"
    success "Created apps/portal/.env from .env.example"
  else
    cat << 'INNER_EOF' > "$PORTAL_ENV"
NEXT_PUBLIC_APP_URL=http://localhost:3000
PORT=3000
HOST=0.0.0.0
HOSTNAME=0.0.0.0
NODE_ENV=development
NEXT_PUBLIC_SUPABASE_URL=https://mrwhtxbhrzyttlsyuofc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_d-7-pJnWomgpNtWFFy_yCA_4axrPll5
REDIS_URL=redis://localhost:6379
INNER_EOF
    success "Created apps/portal/.env with default configuration"
  fi
else
  success "apps/portal/.env already configured"
fi

TOOLS_ENV=".env.tools"
if [ ! -f "$TOOLS_ENV" ]; then
  if [ -f ".env.tools.example" ]; then
    cp ".env.tools.example" "$TOOLS_ENV"
    warn ".env.tools created from .env.tools.example — replace placeholder values before starting Docker tools"
  else
    touch "$TOOLS_ENV"
    warn ".env.tools created — ensure variables are set if required by docker tools"
  fi
else
  success ".env.tools already configured"
fi

# Ensure 0.0.0.0 host binding in apps/portal/.env
if ! grep -q "^HOST=" "$PORTAL_ENV" 2>/dev/null; then
  echo "HOST=0.0.0.0" >> "$PORTAL_ENV"
fi
if ! grep -q "^HOSTNAME=" "$PORTAL_ENV" 2>/dev/null; then
  echo "HOSTNAME=0.0.0.0" >> "$PORTAL_ENV"
fi

# ── 6. Sync Assets, Generate Tokens & Monorepo Policies ────────────────────────
info "Compiling design tokens and verifying boundary policies..."
node scripts/sync-assets-smart.cjs || true
pnpm --filter @repo/theme codegen
pnpm policy:gen
success "Design tokens and workspace policies verified"

# ── 6b. Agent MCP Server Onboarding & Synchronization ────────────────────────
info "Registering and synchronizing Agent MCP servers (Firecrawl, Upstash, Core MCPs)..."
node tools/scripts/mcp-onboard.cjs || true
success "Agent MCP server registry synchronized"

# ── 7. Docker Infrastructure Setup ────────────────────────────────────────────
DOCKER_AVAILABLE=false
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    DOCKER_AVAILABLE=true
  fi
fi

if [ "$DOCKER_AVAILABLE" = true ]; then
  if [ "$START_INFRA" = true ] || [ "$START_DEV" = true ] || [ "$START_PROD" = true ]; then
    info "Docker is available. Setting up infrastructure containers (Redis, DB, etc.)..."
    if [ -f "infra/docker/compose.redis.yml" ]; then
      docker compose -f infra/docker/compose.redis.yml pull || true
      docker compose -f infra/docker/compose.redis.yml up -d
    fi
    if [ -f "infra/docker/compose.tools.yml" ]; then
      docker compose --env-file "$TOOLS_ENV" -f infra/docker/compose.tools.yml pull || true
      docker compose --env-file "$TOOLS_ENV" -f infra/docker/compose.tools.yml up -d
    fi
    success "Docker infrastructure is up and running"
  fi
else
  if [ "$START_INFRA" = true ]; then
    warn "Docker is not running or not installed. Skipping infrastructure setup."
  fi
fi

# ── 8. Build Project ──────────────────────────────────────────────────────────
if [ "$BUILD_PROJECT" = true ]; then
  info "Building the project..."
  pnpm build
  success "Project built successfully"
fi

# ── 9. Summary & Reachability ─────────────────────────────────────────────────
echo
echo -e "${CLR_GREEN}${CLR_BOLD}══════════════════════════════════════════════════════════════${CLR_RESET}"
echo -e "${CLR_GREEN}${CLR_BOLD}  ARCH-SYSTEMS MONOREPO IS FULLY CONFIGURED & READY!          ${CLR_RESET}"
echo -e "${CLR_GREEN}${CLR_BOLD}══════════════════════════════════════════════════════════════${CLR_RESET}"
echo
echo -e "  ${CLR_BOLD}Local Machine URL:${CLR_RESET}   ${CLR_CYAN}http://localhost:${PORT}${CLR_RESET}"
if [ -n "$LAN_IP" ] && [ "$LAN_IP" != "127.0.0.1" ]; then
  echo -e "  ${CLR_BOLD}Local Network URL:${CLR_RESET}   ${CLR_GREEN}${CLR_BOLD}http://${LAN_IP}:${PORT}${CLR_RESET}  ${CLR_DIM}(Any device on Wi-Fi / LAN)${CLR_RESET}"
fi
echo

# ── 10. Start Server (if requested) ───────────────────────────────────────────
if [ "$START_DEV" = true ]; then
  info "Starting development server on 0.0.0.0:${PORT}..."
  exec pnpm dev
elif [ "$START_PROD" = true ]; then
  info "Starting production server on 0.0.0.0:${PORT}..."
  exec pnpm start
else
  echo -e "  ${CLR_BOLD}To start the server right now:${CLR_RESET}"
  echo -e "    ${CLR_CYAN}pnpm dev${CLR_RESET}          ${CLR_DIM}# Starts development server bound to 0.0.0.0${CLR_RESET}"
  echo -e "    ${CLR_CYAN}pnpm build && pnpm start${CLR_RESET}  ${CLR_DIM}# Builds & launches production server${CLR_RESET}"
  echo -e "    ${CLR_CYAN}./setup.sh --dev${CLR_RESET}  ${CLR_DIM}# Auto re-run & start dev server${CLR_RESET}"
  echo
fi
