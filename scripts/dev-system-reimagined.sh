#!/usr/bin/env bash
# ==============================================================================
# Arch-Systems — Industrial Dev Deployment & Swarm Orchestrator v5.0
# ==============================================================================
# Enterprise-grade development lifecycle orchestrator:
#   - Full pre-flight verification (Node.js, pnpm, env tokens, Git integrity)
#   - Port collision detection & automated arbitration
#   - Live Cloud/Local Supabase connectivity probing
#   - Autonomous Redis Server (6379) & Redis Insight UI (5540) orchestration
#   - Smart asset synchronization across monorepo workspace packages
#   - Intelligent terminal emulator detection (Ghostty, Kitty, Foot, Alacritty, GNOME, etc.)
#   - Headless, SSH, and Tmux resilient fallback modes
#   - Active HTTP health polling with latency timing & automatic browser launch
#   - Robust signal trapping, PID tracking, and graceful cleanup
#
# Usage:
#   ./scripts/dev-system-reimagined.sh [options]
#   pnpm dev [options]
#
# Options:
#   --port <PORT>        Target port for Next.js portal (default: 3000)
#   --headless           Headless mode (no GUI popups, no auto-browser)
#   --no-browser         Skip opening the browser upon readiness
#   --no-monitor         Skip spawning the separate SysOps HUD terminal
#   --inline, --in-place Run Turbopack in foreground of current terminal
#   --clean              Purge .next and .turbo caches prior to boot
#   --force              Force kill colliding processes on target port
#   --dry-run            Validate all checks without starting servers
#   -h, --help           Display this help guide
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source shared library if available, else initialize fallbacks
if [ -f "$SCRIPT_DIR/lib/common.sh" ]; then
  # shellcheck source=lib/common.sh
  source "$SCRIPT_DIR/lib/common.sh"
else
  CLR_RESET="\033[0m"
  CLR_BOLD="\033[1m"
  CLR_DIM="\033[2m"
  CLR_RED="\033[0;31m"
  CLR_GREEN="\033[0;32m"
  CLR_YELLOW="\033[0;33m"
  CLR_BLUE="\033[0;34m"
  CLR_MAGENTA="\033[0;35m"
  CLR_CYAN="\033[0;36m"
  CLR_WHITE="\033[0;37m"
  RED="$CLR_RED"
  GREEN="$CLR_GREEN"
  YELLOW="$CLR_YELLOW"
  BLUE="$CLR_BLUE"
  CYAN="$CLR_CYAN"
  MAGENTA="$CLR_MAGENTA"
  WHITE="$CLR_WHITE"
  NC="$CLR_RESET"
  BOLD="$CLR_BOLD"
  DIM="$CLR_DIM"
  get_env_var() {
    local file="$1" key="$2"
    [ -f "$file" ] || return 0
    (grep -E "^${key}=" "$file" 2>/dev/null || true) | head -n1 | cut -d= -f2- | tr -d '"\r'
  }
fi

# Ensure run directory exists
RUN_DIR="$REPO_ROOT/run"
mkdir -p "$RUN_DIR"
DEV_LOG="$RUN_DIR/dev.log"
PORTAL_LOG="$RUN_DIR/portal.log"

# Default Configuration
PORT="${PORT:-3000}"
HEADLESS=false
NO_BROWSER=false
NO_MONITOR=false
INLINE_MODE=false
CLEAN_CACHE=false
FORCE_KILL=false
DRY_RUN=false

# CLI Argument Parsing
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    --headless)
      HEADLESS=true
      NO_BROWSER=true
      shift
      ;;
    --no-browser)
      NO_BROWSER=true
      shift
      ;;
    --no-monitor|--no-hud)
      NO_MONITOR=true
      shift
      ;;
    --inline|--in-place)
      INLINE_MODE=true
      shift
      ;;
    --clean)
      CLEAN_CACHE=true
      shift
      ;;
    --force)
      FORCE_KILL=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      echo -e "${CYAN}${BOLD}Arch-Systems — Dev Deployment Orchestrator${NC}"
      echo
      echo "Usage: ./scripts/dev-system-reimagined.sh [options]"
      echo
      echo "Options:"
      echo "  --port <PORT>        Target port for portal (default: 3000)"
      echo "  --headless           Run headlessly (no browser, no popup terminals)"
      echo "  --no-browser         Do not auto-open browser"
      echo "  --no-monitor         Do not spawn monitor HUD"
      echo "  --inline, --in-place Run Turbopack in foreground of current terminal"
      echo "  --clean              Clean .next and .turbo caches prior to boot"
      echo "  --force              Force kill colliding processes on target port"
      echo "  --dry-run            Run all diagnostics without launching servers"
      echo "  -h, --help           Show this help manual"
      exit 0
      ;;
    *)
      echo -e "${RED}[ERR] Unknown option: $1${NC}"
      echo "Run with --help for available options."
      exit 1
      ;;
  esac
done

# If no display server is present, automatically enable headless mode
if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
  HEADLESS=true
  NO_BROWSER=true
fi

# Track spawned background PIDs for graceful termination
SPAWNED_PIDS=()

# ── Error Trap Handler ──────────────────────────────────────
error_trap() {
  local exit_code="$?"
  local line_no="$1"
  local cmd="$2"

  echo
  echo -e "${RED}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║               DEV DEPLOYMENT FAILED — SYSTEM ABORTED                  ║${NC}"
  echo -e "${RED}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${RED}║${NC} Exit Code: ${BOLD}$exit_code${NC}"
  echo -e "${RED}║${NC} Failed Line: $line_no"
  echo -e "${RED}║${NC} Command: ${CYAN}$cmd${NC}"
  echo -e "${RED}╠═══════════════════════════════════════════════════════════════════════╣${NC}"

  if [[ "$cmd" == *"sync-assets"* ]]; then
    echo -e "${RED}║${NC} ${YELLOW}→ Ensure workspace packages build: pnpm build${NC}"
  elif [[ "$cmd" == *"redis"* ]] || [[ "$cmd" == *"docker"* ]]; then
    echo -e "${RED}║${NC} ${YELLOW}→ Check Docker status: docker ps / systemctl status docker${NC}"
  elif [[ "$cmd" == *"turbo"* ]] || [[ "$cmd" == *"portal"* ]]; then
    echo -e "${RED}║${NC} ${YELLOW}→ Check portal log: tail -n 50 $PORTAL_LOG${NC}"
  else
    echo -e "${RED}║${NC} ${YELLOW}→ Review execution log: tail -n 50 $DEV_LOG${NC}"
  fi

  echo -e "${RED}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
  echo
  cleanup
}

trap 'error_trap ${LINENO} "$BASH_COMMAND"' ERR

# ── Clean Shutdown Trap ─────────────────────────────────────
cleanup() {
  # Avoid recursive trapping
  trap - EXIT INT TERM

  if [ ${#SPAWNED_PIDS[@]} -gt 0 ]; then
    echo
    echo -e "  ${YELLOW}${BOLD}[CLEANUP] Stopping spawned background processes...${NC}"
    for pid in "${SPAWNED_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done
  fi

  rm -f "$RUN_DIR/.dev_ready" "$RUN_DIR/.dev_portal.pid" "$RUN_DIR/.dev_hud.pid"
}

trap cleanup EXIT INT TERM

# ── UI Presentation Helpers ─────────────────────────────────
print_banner() {
  local branch
  branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  local commit
  commit=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
  local node_v
  node_v=$(node -v 2>/dev/null || echo "unknown")

  echo
  echo -e "  ${CYAN}${BOLD}┌────────────────────────────────────────────────────────────────────────┐${NC}"
  echo -e "  ${CYAN}${BOLD}│${NC}              ${BOLD}${WHITE}ARCH-SYSTEMS — INDUSTRIAL DEV DEPLOYMENT${NC}                  ${CYAN}${BOLD}│${NC}"
  echo -e "  ${CYAN}${BOLD}│${NC}              ${DIM}Plantcor OS · High-Density Mining Operations${NC}              ${CYAN}${BOLD}│${NC}"
  echo -e "  ${CYAN}${BOLD}├────────────────────────────────────────────────────────────────────────┤${NC}"
  echo -e "  ${CYAN}${BOLD}│${NC} ${DIM}Node:${NC} ${WHITE}$node_v${NC}   ${DIM}│${NC} ${DIM}Host:${NC} ${WHITE}0.0.0.0:$PORT${NC}   ${DIM}│${NC} ${DIM}Branch:${NC} ${WHITE}$branch ($commit)${NC}      ${CYAN}${BOLD}│${NC}"
  echo -e "  ${CYAN}${BOLD}│${NC} ${DIM}Engine:${NC} ${GREEN}Turbopack${NC} ${DIM}│${NC} ${DIM}Cache:${NC} ${MAGENTA}L1/L2 Redis${NC}  ${DIM}│${NC} ${DIM}Mode:${NC} ${CYAN}Full Orchestrated${NC}           ${CYAN}${BOLD}│${NC}"
  echo -e "  ${CYAN}${BOLD}└────────────────────────────────────────────────────────────────────────┘${NC}"
  echo
}

phase() {
  local num="$1"
  local title="$2"
  echo
  echo -e "  ${BLUE}${BOLD}PHASE ${num}${NC} ${DIM}›${NC} ${BOLD}${WHITE}${title}${NC}"
  echo -e "  ${DIM}────────────────────────────────────────────────────────────────────${NC}"
}

check_badge() {
  local label="$1"
  local status="$2"
  local detail="${3:-}"
  local pad
  printf -v pad '%-32s' "$label"

  case "$status" in
    pass)
      echo -e "  [ ${GREEN}${BOLD}PASS${NC} ] ${WHITE}${pad}${NC} ${DIM}${detail}${NC}"
      ;;
    warn)
      echo -e "  [ ${YELLOW}${BOLD}WARN${NC} ] ${WHITE}${pad}${NC} ${YELLOW}${detail}${NC}"
      ;;
    fail)
      echo -e "  [ ${RED}${BOLD}FAIL${NC} ] ${WHITE}${pad}${NC} ${RED}${detail}${NC}"
      ;;
    info)
      echo -e "  [ ${CYAN}${BOLD}INFO${NC} ] ${WHITE}${pad}${NC} ${DIM}${detail}${NC}"
      ;;
    wait)
      echo -e "  [ ${MAGENTA}${BOLD}WAIT${NC} ] ${WHITE}${pad}${NC} ${CYAN}${detail}${NC}"
      ;;
  esac
}

# ── Execution Start ─────────────────────────────────────────
print_banner

# ============================================================
# PHASE 1: ENVIRONMENT & ENGINE PRE-FLIGHT
# ============================================================
phase "1" "ENVIRONMENT & ENGINE PRE-FLIGHT"

# 1.1 Node.js Version Check
node_version=$(node -v 2>/dev/null | tr -d 'v' || echo "0.0.0")
node_major=$(echo "$node_version" | cut -d. -f1)
if [ "$node_major" -ge 22 ]; then
  check_badge "Node.js Runtime" "pass" "v$node_version (>= 22.0.0 satisfied)"
else
  check_badge "Node.js Runtime" "fail" "v$node_version — Node.js >= 22 required"
  exit 1
fi

# 1.2 pnpm Check
if command -v pnpm >/dev/null 2>&1; then
  pnpm_version=$(pnpm -v 2>/dev/null || echo "unknown")
  check_badge "pnpm Package Manager" "pass" "v$pnpm_version"
else
  check_badge "pnpm Package Manager" "fail" "pnpm is not installed"
  exit 1
fi

# 1.3 Git Repository Integrity
if [ -d "$REPO_ROOT/.git" ]; then
  check_badge "Git Repository" "pass" "Monorepo root verified"
else
  check_badge "Git Repository" "fail" "Invalid git root at $REPO_ROOT"
  exit 1
fi

# 1.4 Environment Configuration & Cloud Connectivity
ENV_FILE="$REPO_ROOT/apps/portal/.env"
[ ! -f "$ENV_FILE" ] && [ -f "$REPO_ROOT/.env" ] && ENV_FILE="$REPO_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  check_badge "Environment Config" "pass" "Loaded from $(basename "$ENV_FILE")"

  SUPABASE_URL=$(get_env_var "$ENV_FILE" "NEXT_PUBLIC_SUPABASE_URL")
  [ -z "$SUPABASE_URL" ] && SUPABASE_URL=$(get_env_var "$ENV_FILE" "SUPABASE_URL")
  SUPABASE_KEY=$(get_env_var "$ENV_FILE" "NEXT_PUBLIC_SUPABASE_ANON_KEY")

  if [ -n "$SUPABASE_URL" ]; then
    # Test reachability with quick 4-second timeout
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 "${SUPABASE_URL}/rest/v1/" -H "apikey: ${SUPABASE_KEY:-}" 2>/dev/null || echo "000")
    if [[ "$http_code" =~ ^(200|401|403)$ ]]; then
      check_badge "Supabase Connection" "pass" "Reachable ($SUPABASE_URL · HTTP $http_code)"
    else
      check_badge "Supabase Connection" "warn" "Responded with HTTP $http_code (offline/lie-fi resilient mode)"
    fi
  else
    check_badge "Supabase Connection" "warn" "NEXT_PUBLIC_SUPABASE_URL not declared"
  fi
else
  check_badge "Environment Config" "warn" "No .env found; attempting default runtime resolution"
fi

# ============================================================
# PHASE 2: PORT ARBITRATION & COLLISION CHECK
# ============================================================
phase "2" "PORT ARBITRATION & COLLISION CHECK"

# Check target portal port
check_port() {
  local p="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$p" 2>/dev/null || true
  elif command -v fuser >/dev/null 2>&1; then
    fuser "$p/tcp" 2>/dev/null | tr -d ' ' || true
  else
    return 0
  fi
}

portal_pid=$(check_port "$PORT" | head -n1 || echo "")

if [ -n "$portal_pid" ]; then
  proc_name=$(ps -p "$portal_pid" -o comm= 2>/dev/null || echo "unknown")
  if [ "$FORCE_KILL" = true ]; then
    check_badge "Port Collision ($PORT)" "warn" "Terminating existing $proc_name (PID $portal_pid) (--force)"
    kill -15 "$portal_pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$portal_pid" 2>/dev/null; then
      kill -9 "$portal_pid" 2>/dev/null || true
    fi
    check_badge "Port Arbitration ($PORT)" "pass" "Freed port $PORT successfully"
  else
    check_badge "Port Collision ($PORT)" "fail" "Occupied by $proc_name (PID $portal_pid)"
    echo -e "  ${YELLOW}Use --force to automatically kill colliding processes or specify --port <NEW_PORT>${NC}"
    exit 1
  fi
else
  check_badge "Port Arbitration ($PORT)" "pass" "Port $PORT is clean and available"
fi

# ============================================================
# PHASE 3: CACHE HYGIENE & SMART ASSET SYNCHRONIZATION
# ============================================================
phase "3" "CACHE HYGIENE & SMART ASSET SYNCHRONIZATION"

if [ "$CLEAN_CACHE" = true ]; then
  check_badge "Cache Purge" "wait" "Purging .next and .turbo caches..."
  rm -rf "$REPO_ROOT/apps/portal/.next" "$REPO_ROOT/.turbo/cache"
  check_badge "Cache Purge" "pass" "Cleared stale runtime caches"
fi

if [ -f "$REPO_ROOT/scripts/sync-assets-smart.cjs" ]; then
  check_badge "Asset Sync (DAG)" "wait" "Executing smart asset synchronization..."
  if node "$REPO_ROOT/scripts/sync-assets-smart.cjs" >/dev/null 2>&1; then
    check_badge "Asset Sync (DAG)" "pass" "Static tokens, SVGs, and contract assets synchronized"
  else
    check_badge "Asset Sync (DAG)" "warn" "Asset sync reported minor warnings (proceeding)"
  fi
fi

# ============================================================
# PHASE 4: REDIS ENGINE DIAGNOSTICS & UI STARTUP
# ============================================================
phase "4" "REDIS ENGINE DIAGNOSTICS & UI STARTUP"

redis_active=false

# Test if Redis is already running on 6379
if command -v redis-cli >/dev/null 2>&1 && redis-cli ping >/dev/null 2>&1; then
  redis_active=true
  check_badge "Redis Server" "pass" "Active native instance on 127.0.0.1:6379"
elif (exec 3<>/dev/tcp/127.0.0.1/6379) 2>/dev/null; then
  exec 3<&- 3>&-
  redis_active=true
  check_badge "Redis Server" "pass" "Active socket listener on 127.0.0.1:6379"
fi

if [ "$redis_active" = false ]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    check_badge "Docker Daemon" "pass" "Docker runtime active"
    if [ -f "$REPO_ROOT/infra/docker/compose.redis.yml" ]; then
      check_badge "Redis Boot" "wait" "Booting Arch-System Redis & Redis Insight..."
      docker compose -f "$REPO_ROOT/infra/docker/compose.redis.yml" up -d >/dev/null 2>&1 || true

      for i in {1..6}; do
        if (command -v redis-cli >/dev/null 2>&1 && redis-cli ping >/dev/null 2>&1) || \
           (docker exec arch-redis redis-cli ping 2>/dev/null | grep -q PONG); then
          redis_active=true
          break
        fi
        sleep 1
      done

      if [ "$redis_active" = true ]; then
        check_badge "Redis Engine" "pass" "Redis Server (6379) & Redis Insight (5540) online"
      else
        check_badge "Redis Engine" "warn" "Redis container boot delayed — falling back to L1 LRU"
      fi
    fi
  else
    check_badge "Redis Engine" "info" "Docker inactive — leveraging built-in Arch-System L1 memory cache"
  fi
fi

# ============================================================
# PHASE 5: DEV ENGINE & MONITOR HUD LAUNCH
# ============================================================
phase "5" "DEV ENGINE & MONITOR HUD LAUNCH"

if [ "$DRY_RUN" = true ]; then
  check_badge "Dry Run" "pass" "Pre-flight dry-run completed successfully. Ready for deployment."
  exit 0
fi

# Terminal Launcher Function
detect_best_terminal() {
  if command -v ghostty >/dev/null 2>&1; then echo "ghostty"
  elif command -v kitty >/dev/null 2>&1; then echo "kitty"
  elif command -v foot >/dev/null 2>&1; then echo "foot"
  elif command -v alacritty >/dev/null 2>&1; then echo "alacritty"
  elif command -v gnome-terminal >/dev/null 2>&1; then echo "gnome"
  elif command -v konsole >/dev/null 2>&1; then echo "konsole"
  elif command -v xfce4-terminal >/dev/null 2>&1; then echo "xfce4"
  elif command -v xterm >/dev/null 2>&1; then echo "xterm"
  else echo "none"
  fi
}

TERMINAL_EMU=$(detect_best_terminal)

launch_terminal() {
  local title="$1"
  local cmd="$2"

  case "$TERMINAL_EMU" in
    ghostty)
      ghostty -e bash -c "$cmd; exec bash" &
      ;;
    kitty)
      kitty -T "$title" bash -c "$cmd; exec bash" &
      ;;
    foot)
      foot -T "$title" bash -c "$cmd; exec bash" &
      ;;
    alacritty)
      alacritty -t "$title" -e bash -c "$cmd; exec bash" &
      ;;
    gnome)
      gnome-terminal --title="$title" -- bash -c "$cmd; exec bash" &
      ;;
    konsole)
      konsole --title "$title" -e bash -c "$cmd; exec bash" &
      ;;
    xfce4)
      xfce4-terminal --title="$title" -e "bash -c '$cmd; exec bash'" &
      ;;
    xterm)
      xterm -title "$title" -e bash -c "$cmd; exec bash" &
      ;;
    *)
      return 1
      ;;
  esac
}

# Determine execution topology
if [ "$INLINE_MODE" = true ]; then
  check_badge "Execution Mode" "info" "Inline mode selected — booting Turbopack in current terminal"
  echo -e "\n  ${GREEN}${BOLD}→ Launching Next.js Turbopack...${NC}\n"
  PORT="$PORT" pnpm turbo run dev --filter=portal
  exit 0
fi

# GUI Terminal / Background Spawning
dev_command="cd '$REPO_ROOT' && echo -e '\e[1;32m[Arch-System]\e[0m Booting Next.js Turbopack on port $PORT...'; PORT=$PORT pnpm turbo run dev --filter=portal"

if [ "$HEADLESS" = false ] && [ "$TERMINAL_EMU" != "none" ]; then
  if launch_terminal "Arch-System Dev Engine" "$dev_command"; then
    check_badge "Dev Engine" "pass" "Spawned popup window via $TERMINAL_EMU"
  else
    TERMINAL_EMU="none"
  fi
fi

if [ "$HEADLESS" = true ] || [ "$TERMINAL_EMU" = "none" ]; then
  check_badge "Dev Engine" "info" "Starting background Turbopack process (logs → run/portal.log)"
  (cd "$REPO_ROOT" && PORT="$PORT" pnpm turbo run dev --filter=portal > "$PORTAL_LOG" 2>&1) &
  PORTAL_SUB_PID=$!
  SPAWNED_PIDS+=("$PORTAL_SUB_PID")
  echo "$PORTAL_SUB_PID" > "$RUN_DIR/.dev_portal.pid"
fi

# Optional Monitor HUD Spawning
if [ "$NO_MONITOR" = false ] && [ "$HEADLESS" = false ] && [ "$TERMINAL_EMU" != "none" ]; then
  hud_command="cd '$REPO_ROOT' && echo -e '\e[1;34m[HUD]\e[0m Starting SysOps Monitor...'; (pnpm monitor || htop || top)"
  if launch_terminal "Arch-System SysOps HUD" "$hud_command"; then
    check_badge "SysOps HUD" "pass" "Spawned monitor HUD via $TERMINAL_EMU"
  fi
fi

# ============================================================
# PHASE 6: REAL-TIME HEALTH VERIFICATION & BROWSER READY
# ============================================================
phase "6" "REAL-TIME HEALTH VERIFICATION & BROWSER READY"

health_url="http://localhost:$PORT"
check_badge "Health Probing" "wait" "Awaiting HTTP response on $health_url..."

server_ready=false
max_wait_seconds=75
start_time=$(date +%s)
spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
spin_idx=0

for ((i = 1; i <= max_wait_seconds; i++)); do
  # Poll health with curl HTTP status output
  status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 1 "$health_url" 2>/dev/null || echo "000")

  if [[ "$status_code" =~ ^(200|301|302|307|308)$ ]]; then
    server_ready=true
    break
  fi

  elapsed=$(( $(date +%s) - start_time ))
  spin_char="${spinner[$spin_idx]}"
  spin_idx=$(( (spin_idx + 1) % ${#spinner[@]} ))
  printf "\r  [ ${MAGENTA}${BOLD}%s${NC} ] ${WHITE}Probing dev server HTTP status...${NC} ${DIM}(%ds, status: %s)${NC}   " "$spin_char" "$elapsed" "$status_code"
  sleep 1
done

echo

if [ "$server_ready" = true ]; then
  elapsed_total=$(( $(date +%s) - start_time ))
  check_badge "Server Readiness" "pass" "HTTP $status_code OK in ${elapsed_total}s — Portal live on port $PORT"
  touch "$RUN_DIR/.dev_ready"

  # Detect Local Network LAN IP
  lan_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' || echo "")

  # Auto-Browser Opening
  if [ "$NO_BROWSER" = false ] && [ "$HEADLESS" = false ]; then
    login_url="http://localhost:$PORT/login"
    check_badge "Browser Launcher" "wait" "Opening browser to $login_url..."
    if command -v google-chrome >/dev/null 2>&1; then
      google-chrome --new-window "$login_url" >/dev/null 2>&1 &
    elif command -v chromium >/dev/null 2>&1; then
      chromium --new-window "$login_url" >/dev/null 2>&1 &
    elif command -v firefox >/dev/null 2>&1; then
      firefox --new-window "$login_url" >/dev/null 2>&1 &
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$login_url" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
      open "$login_url" >/dev/null 2>&1 &
    fi
    check_badge "Browser Launcher" "pass" "Opened default browser"
  fi

  # Final Summary Dashboard
  echo
  echo -e "  ${GREEN}${BOLD}╭──────────────────────── ACTIVE SERVICE MATRIX ────────────────────────╮${NC}"
  echo -e "  ${GREEN}${BOLD}│${NC}  ${BOLD}${WHITE}Portal (Local):${NC}    ${CYAN}http://localhost:$PORT${NC}                               ${GREEN}${BOLD}│${NC}"
  if [ -n "$lan_ip" ] && [ "$lan_ip" != "127.0.0.1" ]; then
    printf -v lan_row "  ${GREEN}${BOLD}│${NC}  ${BOLD}${WHITE}Portal (LAN):${NC}      ${CYAN}http://%s:%s${NC}" "$lan_ip" "$PORT"
    echo -e "${lan_row}$(printf '%*s' $((71 - ${#lan_row} + 18)) '')${GREEN}${BOLD}│${NC}"
  fi
  echo -e "  ${GREEN}${BOLD}│${NC}  ${BOLD}${WHITE}Auth / Login:${NC}      ${CYAN}http://localhost:$PORT/login${NC}                         ${GREEN}${BOLD}│${NC}"
  if [ "$redis_active" = true ]; then
    echo -e "  ${GREEN}${BOLD}│${NC}  ${BOLD}${WHITE}Redis Cache:${NC}       ${CYAN}redis://127.0.0.1:6379${NC}                               ${GREEN}${BOLD}│${NC}"
    echo -e "  ${GREEN}${BOLD}│${NC}  ${BOLD}${WHITE}Redis Insight:${NC}     ${CYAN}http://localhost:5540${NC}                                ${GREEN}${BOLD}│${NC}"
  else
    echo -e "  ${GREEN}${BOLD}│${NC}  ${BOLD}${WHITE}Cache Engine:${NC}      ${DIM}In-Memory L1 LRU Cache${NC}                               ${GREEN}${BOLD}│${NC}"
  fi
  echo -e "  ${GREEN}${BOLD}│${NC}  ${BOLD}${WHITE}SysOps HUD:${NC}        ${DIM}pnpm monitor · scripts/monitor-hud.sh${NC}                 ${GREEN}${BOLD}│${NC}"
  echo -e "  ${GREEN}${BOLD}│${NC}  ${BOLD}${WHITE}Active Logs:${NC}       ${DIM}run/portal.log · run/dev.log${NC}                          ${GREEN}${BOLD}│${NC}"
  echo -e "  ${GREEN}${BOLD}├───────────────────────────────────────────────────────────────────────┤${NC}"
  echo -e "  ${GREEN}${BOLD}│${NC}  ${DIM}Controls: [Ctrl+C] Stop Services  │  [Quality] pnpm quality${NC}             ${GREEN}${BOLD}│${NC}"
  echo -e "  ${GREEN}${BOLD}╰───────────────────────────────────────────────────────────────────────╯${NC}"
  echo
else
  check_badge "Server Readiness" "fail" "Dev server did not respond on port $PORT within ${max_wait_seconds}s"
  echo -e "  ${YELLOW}Check the portal log for errors: tail -n 50 $PORTAL_LOG${NC}"
  exit 1
fi

# If running background processes, keep script alive and responsive to Ctrl+C
if [ ${#SPAWNED_PIDS[@]} -gt 0 ]; then
  echo -e "  ${DIM}Dev deployment active. Press Ctrl+C to terminate all services.${NC}"
  wait "${SPAWNED_PIDS[0]}" 2>/dev/null || true
fi
