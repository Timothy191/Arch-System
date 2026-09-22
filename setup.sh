#!/usr/bin/env bash
# ==============================================================================
# Arch-Systems — Automated One-Click Setup & Server Orchestration
# ==============================================================================
# Usage:
#   ./setup.sh              # Standard setup (install dependencies, configure, build tokens)
#   ./setup.sh --dev        # Setup and immediately launch dev server on 0.0.0.0
#   ./setup.sh --start      # Setup and launch production server on 0.0.0.0
#   ./setup.sh --clean      # Full clean wipe of node_modules/caches and fresh reinstall
#   ./setup.sh --reinstall  # Alias for --clean
# ==============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Formatting colors
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_DIM="\033[2m"
CLR_GREEN="\033[0;32m"
CLR_CYAN="\033[0;36m"
CLR_YELLOW="\033[0;33m"
CLR_RED="\033[0;31m"
CLR_WHITE="\033[0;37m"

info()    { echo -e "  ${CLR_CYAN}ℹ${CLR_RESET} ${CLR_WHITE}$*${CLR_RESET}"; }
success() { echo -e "  ${CLR_GREEN}✓${CLR_RESET} ${CLR_WHITE}$*${CLR_RESET}"; }
warn()    { echo -e "  ${CLR_YELLOW}⚠${CLR_RESET} ${CLR_YELLOW}$*${CLR_RESET}"; }
error()   { echo -e "  ${CLR_RED}✖${CLR_RESET} ${CLR_RED}$*${CLR_RESET}"; }

# Detect LAN IP
get_lan_ip() {
  local ip=""
  if command -v hostname >/dev/null 2>&1; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
    ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
  fi
  if [ -z "$ip" ] && command -v ifconfig >/dev/null 2>&1; then
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

for arg in "$@"; do
  case "$arg" in
    --clean|--reinstall|--fresh)
      CLEAN_MODE=true
      ;;
    --dev)
      START_DEV=true
      ;;
    --start|--prod|--production)
      START_PROD=true
      ;;
    --help|-h)
      echo "Arch-Systems One-Click Setup"
      echo "Usage: ./setup.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --clean, --reinstall   Wipe node_modules, cache, and perform clean reinstall"
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

if [ "$NODE_MAJOR" -lt 20 ]; then
  warn "Detected Node.js v${NODE_VERSION}. Node.js 20+ is required (Node 22+ recommended)."
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
    cat << 'EOF' > "$PORTAL_ENV"
NEXT_PUBLIC_APP_URL=http://localhost:3000
PORT=3000
HOST=0.0.0.0
HOSTNAME=0.0.0.0
NODE_ENV=development
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
REDIS_URL=redis://localhost:6379
EOF
    success "Created apps/portal/.env with default configuration"
  fi
else
  success "apps/portal/.env already configured"
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

# ── 7. Summary & Reachability ─────────────────────────────────────────────────
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

# ── 8. Start Server (if requested) ────────────────────────────────────────────
if [ "$START_DEV" = true ]; then
  info "Starting development server on 0.0.0.0:${PORT}..."
  exec pnpm dev
elif [ "$START_PROD" = true ]; then
  info "Building for production..."
  pnpm build
  info "Starting production server on 0.0.0.0:${PORT}..."
  exec pnpm start
else
  echo -e "  ${CLR_BOLD}To start the server right now:${CLR_RESET}"
  echo -e "    ${CLR_CYAN}pnpm dev${CLR_RESET}          ${CLR_DIM}# Starts development server bound to 0.0.0.0${CLR_RESET}"
  echo -e "    ${CLR_CYAN}pnpm build && pnpm start${CLR_RESET}  ${CLR_DIM}# Builds & launches production server${CLR_RESET}"
  echo -e "    ${CLR_CYAN}./setup.sh --dev${CLR_RESET}  ${CLR_DIM}# Auto re-run & start dev server${CLR_RESET}"
  echo
fi
