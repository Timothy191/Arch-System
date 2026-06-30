#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

# ──────────────────────────────────────────────────────────
# Arch-Systems — Lightning Dev Script v3
# Starts Supabase + Next.js HMR, runs 4-phase health check,
# then opens browser to login page.
# ──────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"

# ── Colors ───────────────────────────────────────────────
DIM='\033[0;2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

PASS="${GREEN}${BOLD}  ✓${NC}"
FAIL="${RED}${BOLD}  ✗${NC}"
SKIP="${YELLOW}${BOLD}  –${NC}"
INFO="${CYAN}${BOLD}  →${NC}"

# ── Helpers ──────────────────────────────────────────────
phase() {
  local n="$1" title="$2"
  echo
  echo -e "  ${BOLD}${MAGENTA}━━━  Phase ${n}: ${title}  ━━━${NC}"
}

check() {
  local label="$1" status="$2" detail="${3:-}"
  if [ "$status" = "pass" ]; then
    echo -e "  ${PASS} ${label}${detail:+ $DIM$detail$NC}"
  elif [ "$status" = "fail" ]; then
    echo -e "  ${FAIL} ${label}${detail:+ $RED$detail$NC}"
  elif [ "$status" = "warn" ]; then
    echo -e "  ${YELLOW}${BOLD}  ⚠${NC} ${label}${detail:+ $YELLOW$detail$NC}"
  elif [ "$status" = "skip" ]; then
    echo -e "  ${SKIP} ${label}${detail:+ $DIM$detail$NC}"
  fi
}

spinner() {
  local pid=$1 msg="$2"
  local frames=('◐' '◓' '◑' '◒')
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYAN}${frames[$i]}${NC} ${msg}... "
    i=$(( (i+1) % 4 ))
    sleep 0.2
  done
  printf "\r  ${GREEN}◉${NC} ${msg}       \n"
}

wait_for() {
  local url="$1" label="$2" max="${3:-60}" delay="${4:-2}"
  for i in $(seq 1 "$max"); do
    if curl -fs "$url" > /dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

PORTAL_ENV_FILE="$REPO_ROOT/apps/portal/.env"
PORTAL_ENV_LOCAL="$REPO_ROOT/apps/portal/.env.local"
SUPABASE_API_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}"
REMOTE_SUPABASE=false
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6380}"
REDIS_COMPOSE="$REPO_ROOT/redis/docker-compose.yml"
REDIS_CONTAINER="arch-redis-offload"

read_env_var() {
  local key="$1" file="$2"
  [ -f "$file" ] || return 1
  local line
  line=$(grep -E "^${key}=" "$file" 2>/dev/null | tail -n1 || true)
  [ -n "$line" ] || return 1
  echo "${line#*=}" | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

is_local_supabase_url() {
  case "$1" in
    http://127.0.0.1:*|http://localhost:*|https://127.0.0.1:*|https://localhost:*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

load_supabase_config() {
  local from_file="" file

  for file in "$PORTAL_ENV_LOCAL" "$PORTAL_ENV_FILE" "$REPO_ROOT/.env"; do
    from_file=$(read_env_var "NEXT_PUBLIC_SUPABASE_URL" "$file" || true)
    if [ -n "$from_file" ]; then
      SUPABASE_API_URL="$from_file"
      break
    fi
  done

  if [ -z "$from_file" ]; then
    for file in "$PORTAL_ENV_LOCAL" "$PORTAL_ENV_FILE" "$REPO_ROOT/.env"; do
      from_file=$(read_env_var "SUPABASE_URL" "$file" || true)
      if [ -n "$from_file" ]; then
        SUPABASE_API_URL="$from_file"
        break
      fi
    done
  fi

  SUPABASE_API_URL="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-$SUPABASE_API_URL}}"
  SUPABASE_API_URL="${SUPABASE_API_URL%/}"

  if is_local_supabase_url "$SUPABASE_API_URL"; then
    REMOTE_SUPABASE=false
  else
    REMOTE_SUPABASE=true
  fi
}

load_redis_config() {
  local from_file="" file

  for file in "$PORTAL_ENV_LOCAL" "$PORTAL_ENV_FILE" "$REPO_ROOT/.env"; do
    from_file=$(read_env_var "REDIS_URL" "$file" || true)
    if [ -n "$from_file" ]; then
      REDIS_URL="$from_file"
      break
    fi
  done

  REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6380}"
}

redis_reachable() {
  local url="$1"
  local host="localhost" port="6379"

  if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -u "$url" PING 2>/dev/null | grep -q "PONG"; then
      return 0
    fi
  fi

  if [[ "$url" =~ redis://([^:@/]+)(:([0-9]+))? ]]; then
    host="${BASH_REMATCH[1]}"
    if [ -n "${BASH_REMATCH[3]}" ]; then
      port="${BASH_REMATCH[3]}"
    fi
  fi

  if command -v nc >/dev/null 2>&1 && nc -z "$host" "$port" 2>/dev/null; then
    return 0
  fi

  (timeout 1 bash -c "echo >/dev/tcp/${host}/${port}") 2>/dev/null
}

supabase_rest_url() {
  echo "${SUPABASE_API_URL%/}/rest/v1/"
}

# Returns 0 when the REST endpoint responds (200 or 401 without a key is OK).
supabase_api_reachable() {
  local url="$1"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  case "$code" in
    200|401) return 0 ;;
    *) return 1 ;;
  esac
}

detect_compose_cmd() {
  if docker compose version > /dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose > /dev/null 2>&1; then
    echo "docker-compose"
  else
    echo "docker compose"
  fi
}

COMPOSE_CMD=$(detect_compose_cmd)

banner() {
  clear 2>/dev/null || true
  echo
  echo -e "  ${BOLD}${CYAN}    ___    _   _    ___    _   _   ___   _____   ___   ___ ${NC}"
  echo -e "  ${BOLD}${CYAN}   / _ \  | | | |  / __|  | | | | / __| |_   _| | _ \ / __|${NC}"
  echo -e "  ${BOLD}${CYAN}  | (_) | | |_| | | (__   | |_| | \__ \   | |   |  _/ \__ \${NC}"
  echo -e "  ${BOLD}${CYAN}   \___/   \__,_|  \___|   \___/  |___/   |_|   |_|   |___/${NC}"
  echo
  echo -e "  ${DIM}Lightning Dev — Supabase + HMR${NC}"
  echo -e "  ${DIM}$(date '+%a %b %d %Y  %H:%M')${NC}"
  echo
}

# ── Browser / Status Terminal ────────────────────────────
open_browser() {
  local login_url="http://localhost:$PORT/login?_=$(date +%s)"
  if command -v google-chrome > /dev/null 2>&1; then
    google-chrome --new-window "$login_url" 2>/dev/null &
  elif command -v chromium > /dev/null 2>&1; then
    chromium --new-window "$login_url" 2>/dev/null &
  elif command -v firefox > /dev/null 2>&1; then
    firefox --new-window "$login_url" 2>/dev/null &
  elif command -v xdg-open > /dev/null 2>&1; then
    xdg-open "$login_url" 2>/dev/null &
  elif command -v open > /dev/null 2>&1; then
    open "$login_url"
  fi
}

detect_terminal() {
  if command -v kitty > /dev/null 2>&1; then         echo "kitty"
  elif command -v gnome-terminal > /dev/null 2>&1; then echo "gnome"
  elif command -v konsole > /dev/null 2>&1; then      echo "konsole"
  elif command -v alacritty > /dev/null 2>&1; then    echo "alacritty"
  elif command -v xfce4-terminal > /dev/null 2>&1; then echo "xfce4"
  elif command -v xterm > /dev/null 2>&1; then        echo "xterm"
  else echo "none"
  fi
}

launch_status_terminal() {
  local script="$REPO_ROOT/.dev-status-$$.sh"
  cat > "$script" << 'STATUSEOF'
#!/bin/bash
clear
echo -e "\033[0;35m╔════════════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[0;35m║           ARCH-SYSTEMS — SYSTEM STATUS                          ║\033[0m"
echo -e "\033[0;35m╚════════════════════════════════════════════════════════════════╝\033[0m"
echo ""

echo -e "\033[1mServices:\033[0m"
echo "────────────────────────────────────────────────────────────────"

pstat="\033[0;31mOFFLINE\033[0m"
curl -fs http://localhost:PORT_PLACEHOLDER > /dev/null 2>&1 && pstat="\033[0;32mRUNNING\033[0m"
echo -e "  Portal      $pstat    http://localhost:PORT_PLACEHOLDER"

sstat="\033[0;31mOFFLINE\033[0m"
curl -fs http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1 && sstat="\033[0;32mRUNNING\033[0m"
echo -e "  Supabase    $sstat    http://localhost:54321"

echo ""
echo -e "\033[1mDocker:\033[0m"
echo "────────────────────────────────────────────────────────────────"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  Docker not available"

echo ""
echo -e "\033[1mRecent Logs:\033[0m"
echo "────────────────────────────────────────────────────────────────"
if [ -f "LOG_PLACEHOLDER" ]; then
  tail -20 "LOG_PLACEHOLDER" 2>/dev/null | while IFS= read -r line; do
    echo "  $line"
  done
else
  echo "  No log file yet"
fi

echo ""
echo -e "\033[1mSystem:\033[0m"
echo "────────────────────────────────────────────────────────────────"
echo -e "  Memory:    $(free -h 2>/dev/null | awk '/^Mem:/{print $3 "/" $2}' || echo 'N/A')"
echo -e "  Disk:      $(df -h . 2>/dev/null | awk 'NR==2{print $3 "/" $2}' || echo 'N/A')"

echo ""
echo -e "\033[0;35m────────────────────────────────────────────────────────────────\033[0m"
echo -e "\033[0;36mPress Enter to close this window...\033[0m"
read
STATUSEOF
  sed -i "s|PORT_PLACEHOLDER|$PORT|g; s|LOG_PLACEHOLDER|$REPO_ROOT/run/portal.log|g" "$script"
  chmod +x "$script"

  local term
  term=$(detect_terminal)
  case "$term" in
    kitty)      kitty --title "Arch-Systems Status" bash "$script" & ;;
    gnome)      gnome-terminal --title="Arch-Systems Status" -- bash "$script" & ;;
    konsole)    konsole --title "Arch-Systems Status" -e "bash $script" & ;;
    alacritty)  alacritty -t "Arch-Systems Status" -e bash "$script" & ;;
    xfce4)      xfce4-terminal --title="Arch-Systems Status" -e "bash $script" & ;;
    xterm)      xterm -title "Arch-Systems Status" -e "bash $script" & ;;
  esac
  sleep 1
  rm -f "$script"
}

show_results() {
  echo
  echo -e "  ${GREEN}${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
  echo -e "  ${GREEN}${BOLD}│  All systems go — edit any file, see live updates      │${NC}"
  echo -e "  ${GREEN}${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
  echo
  echo -e "  ${BOLD}Login:${NC}    ${CYAN}http://localhost:$PORT/login${NC}"
  echo -e "  ${BOLD}Portal:${NC}   ${CYAN}http://localhost:$PORT${NC}"
  if [ "$START_CMS" = "true" ]; then
    echo -e "  ${BOLD}CMS:${NC}      ${CYAN}http://localhost:3001${NC}"
  fi
  if [ "$START_OVERVIEW" = "true" ]; then
    echo -e "  ${BOLD}Overview:${NC}  ${CYAN}http://localhost:3002${NC}"
  fi
  echo -e "  ${BOLD}Redis:${NC}    ${CYAN}${REDIS_URL}${NC}"
  if [ "$REMOTE_SUPABASE" = "true" ]; then
    echo -e "  ${BOLD}Studio:${NC}   ${DIM}Supabase Dashboard (remote)${NC}"
    echo -e "  ${BOLD}API:${NC}      ${CYAN}${SUPABASE_API_URL}${NC}"
  else
    echo -e "  ${BOLD}Studio:${NC}   ${CYAN}http://localhost:54323${NC}"
    echo -e "  ${BOLD}API:${NC}      ${CYAN}http://localhost:54321${NC}"
  fi
  echo
  echo -e "  ${DIM}Stop with Ctrl+C${NC}"
  echo
}

cleanup() {
  echo
  echo -e "  ${YELLOW}Shutting down...${NC}"
  for pidfile in .portal.pid .cms.pid .overview.pid; do
    [ -f "$REPO_ROOT/run/$pidfile" ] && kill "$(cat "$REPO_ROOT/run/$pidfile")" 2>/dev/null || true
    rm -f "$REPO_ROOT/run/$pidfile"
  done
}
trap cleanup EXIT INT TERM

# ── Cleanup helpers ──────────────────────────────────────
clean_dir_cache() {
  local dir="$1" name="$2"
  if [ -d "$dir" ]; then
    local size
    size=$(du -sh "$dir" 2>/dev/null | awk '{print $1}')
    rm -rf "$dir"
    check "$name" "pass" "freed ${size:-?}"
  else
    check "$name" "skip" "not present"
  fi
}

smart_cache_cleanup() {
  local max_size_mb=500
  local max_age_days=7

  if [ -d "$REPO_ROOT/.nx/cache" ]; then
    local cache_size
    cache_size=$(du -sm "$REPO_ROOT/.nx/cache" 2>/dev/null | cut -f1)
    if [ -n "$cache_size" ] && [ "$cache_size" -gt "$max_size_mb" ]; then
      echo "  🧹 Cache size (${cache_size}MB) exceeds limit, cleaning entries older than ${max_age_days} days..."
      find "$REPO_ROOT/.nx/cache" -type f -mtime +$max_age_days -delete
      check "Nx cache cleanup" "pass" "removed old entries (${cache_size}MB → cleaned)"
    else
      check "Nx cache" "pass" "size acceptable (${cache_size}MB)"
    fi
  else
    check "Nx cache" "skip" "not present"
  fi

  # Clean Python bytecode (safe operation)
  if [ -d "$REPO_ROOT" ]; then
    local pycache_count
    pycache_count=$(find "$REPO_ROOT" -type d -name "__pycache__" 2>/dev/null | wc -l)
    if [ "$pycache_count" -gt 0 ]; then
      find "$REPO_ROOT" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
      check "Python bytecode" "pass" "removed ${pycache_count} __pycache__ directories"
    else
      check "Python bytecode" "skip" "no __pycache__ directories"
    fi
  fi
}

# ══════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════

FORCE_KILL=false
START_TOOLS=false
QUICK_MODE=false
START_CMS=false
START_OVERVIEW=false
RUN_E2E=false
while [ $# -gt 0 ]; do
  case "$1" in
    --force|-f) FORCE_KILL=true; shift ;;
    --tools|-t) START_TOOLS=true; shift ;;
    --quick|-q) QUICK_MODE=true; shift ;;
    --cms)      START_CMS=true; shift ;;
    --overview) START_OVERVIEW=true; shift ;;
    --e2e)      RUN_E2E=true; shift ;;
    --all)      START_CMS=true; START_OVERVIEW=true; shift ;;
    *) shift ;;
  esac
done

banner

if [ "$QUICK_MODE" = "true" ]; then
  echo -e "  ${YELLOW}${BOLD}⚡ Quick mode${NC} — skipping Docker/Supabase, starting portal only"
  echo
fi

# Load portal Supabase URL early (after optional --quick flag) for remote detection.
if [ -f "$PORTAL_ENV_LOCAL" ] || [ -f "$PORTAL_ENV_FILE" ] || [ -f "$REPO_ROOT/.env" ]; then
  load_supabase_config
fi
if [ "$REMOTE_SUPABASE" = "true" ] && [ "$QUICK_MODE" != "true" ]; then
  echo -e "  ${YELLOW}${BOLD}☁ Remote Supabase${NC} — skipping local Docker stack"
  echo -e "  ${DIM}Using ${SUPABASE_API_URL}${NC}"
  echo
fi

# ── Phase 0: Pre-flight (Cache & Stale Artifacts) ────────
phase 0 "Pre-flight"

# Clean leftover temp status scripts
rm -f "$REPO_ROOT/.dev-status-"*.sh
check "Temp artifacts" "pass" "cleaned"

# Sync global assets (smart sync with checksums)
if [ -f "$REPO_ROOT/scripts/sync-assets-smart.cjs" ]; then
  node "$REPO_ROOT/scripts/sync-assets-smart.cjs"
elif [ -f "$REPO_ROOT/scripts/sync-assets.sh" ]; then
  bash "$REPO_ROOT/scripts/sync-assets.sh"
  check "Global assets" "pass" "synchronized (legacy)"
else
  check "Global assets" "fail" "sync script missing"
fi

portal_healthy() {
  curl -fs "http://localhost:$PORT/login" -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q 200
}

# Check if any source file changed since portal last started
source_files_stale() {
  local marker="$REPO_ROOT/run/.portal.start"
  [ ! -f "$marker" ] && return 0
  find "$REPO_ROOT/apps/portal" \
    \( -path "*/node_modules" -o -path "*/.next" -o -path "*/public" -o -path "*/.nx" \) -prune -o \
    -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.mjs" -o -name "*.js" \) \
    -newer "$marker" -print -quit 2>/dev/null | grep -q .
}

FORCE_RESTART=false
if portal_healthy; then
  check "Portal health" "pass" "serving pages"
  if source_files_stale; then
    check "Source files" "warn" "changed since last start — force restart"
    FORCE_RESTART=true
  else
    check "Source files" "pass" "no changes since last start"
  fi
else
  check "Portal health" "warn" "needs restart"
  FORCE_RESTART=true
fi

if [ "$FORCE_RESTART" = "true" ]; then
  check "Restart" "pass" "preparing fresh start"

  if [ -f "$REPO_ROOT/run/.portal.pid" ]; then
    old_pid=$(cat "$REPO_ROOT/run/.portal.pid")
    kill "$old_pid" 2>/dev/null || true
    rm -f "$REPO_ROOT/run/.portal.pid" "$REPO_ROOT/run/.portal.start"
    check "Stale portal process" "pass" "PID $old_pid cleaned"
  else
    check "Stale portal process" "skip" "no pid file"
  fi

  if lsof -ti:"$PORT" > /dev/null 2>&1; then
    lsof -ti:"$PORT" | xargs kill 2>/dev/null || true
    sleep 1
    check "Port $PORT cleared" "pass" "freed by force"
  else
    check "Port $PORT cleared" "pass" "already free"
  fi

  # Project-wide Cache Cleanup (Smart Cleanup)
  clean_dir_cache "$REPO_ROOT/.kilo" "Agent run cache (.kilo)"
  clean_dir_cache "$REPO_ROOT/.remember" "Agent memory cache (.remember)"
  smart_cache_cleanup  # Smart Nx cache cleanup + Python bytecode
  clean_dir_cache "$REPO_ROOT/.venv" "Python virtual environment (.venv)"
  clean_dir_cache "$REPO_ROOT/.vercel" "Vercel cache (.vercel)"

  if [ -f "$REPO_ROOT/skills-lock.json" ]; then
    rm -f "$REPO_ROOT/skills-lock.json"
    check "skills-lock.json" "pass" "removed"
  fi

  clean_dir_cache "$REPO_ROOT/deployment-logs" "Deployment logs directory"
  clean_dir_cache "$REPO_ROOT/apps/portal/.next/cache" "Next.js portal cache"
  clean_dir_cache "$REPO_ROOT/apps/cms/.next/cache" "Next.js CMS cache"
  clean_dir_cache "$REPO_ROOT/apps/overview/.next/cache" "Next.js overview cache"
  if [ -f "$REPO_ROOT/run/portal.log" ]; then
    logsize=$(du -sh "$REPO_ROOT/run/portal.log" 2>/dev/null | awk '{print $1}')
    : > "$REPO_ROOT/run/portal.log"
    check "Portal log" "pass" "cleared ${logsize:-old log}"
  else
    check "Portal log" "skip" "not present"
  fi

  SKIP_RESTART=false
else
  SKIP_RESTART=true
fi

# ── Phase 1: Environment ─────────────────────────────────
phase 1 "Environment"

env_pass=true
node -v > /dev/null 2>&1 && check "Node.js" "pass" "$(node -v)" || { check "Node.js" "fail"; env_pass=false; }
pnpm -v > /dev/null 2>&1 && check "pnpm" "pass" "$(pnpm -v)" || { check "pnpm" "fail"; env_pass=false; }

# 1a. Portal environment file (needed before Supabase URL detection)
if [ ! -f "$PORTAL_ENV_FILE" ] && [ ! -f "$PORTAL_ENV_LOCAL" ]; then
  if [ -f "$REPO_ROOT/apps/portal/env/.env.example" ]; then
    echo -e "  ${INFO} Apps portal .env missing. Copying from env/.env.example..."
    cp "$REPO_ROOT/apps/portal/env/.env.example" "$PORTAL_ENV_FILE"
    check "Environment file" "pass" "copied from template"
    if grep -q -E "your-|TODO|CHANGEME" "$PORTAL_ENV_FILE" 2>/dev/null; then
      check "Environment secrets" "warn" "contains placeholder values — please configure them in apps/portal/.env"
    fi
  elif [ -f "$REPO_ROOT/apps/portal/.env.example" ]; then
    echo -e "  ${INFO} Apps portal .env missing. Copying from .env.example..."
    cp "$REPO_ROOT/apps/portal/.env.example" "$PORTAL_ENV_FILE"
    check "Environment file" "pass" "copied from template"
    if grep -q -E "your-|TODO|CHANGEME" "$PORTAL_ENV_FILE" 2>/dev/null; then
      check "Environment secrets" "warn" "contains placeholder values — please configure them in apps/portal/.env"
    fi
  else
    check "Environment file" "fail" "missing and no .env.example found"
    env_pass=false
  fi
else
  check "Environment file" "pass" "exists"
fi

load_supabase_config
load_redis_config
if [ "$REMOTE_SUPABASE" = "true" ]; then
  check "Supabase target" "pass" "remote ${SUPABASE_API_URL}"
else
  check "Supabase target" "pass" "local ${SUPABASE_API_URL}"
fi

check "Redis target" "pass" "${REDIS_URL}"

# 1b. Check & Fix Docker (skip in quick mode; optional when remote + Redis already up)
if [ "$QUICK_MODE" = "true" ]; then
  check "Docker" "skip" "quick mode"
elif [ "$REMOTE_SUPABASE" = "true" ]; then
  if docker info > /dev/null 2>&1; then
    check "Docker" "pass" "available for Redis"
  elif redis_reachable "$REDIS_URL"; then
    check "Docker" "skip" "remote Supabase — native Redis already running"
  else
    check "Docker" "warn" "not running — Redis container may not start"
  fi
else
  if ! docker info > /dev/null 2>&1; then
    echo -e "  ${INFO} Docker is not running. Attempting to start docker..."
    started=false
    if [[ "$OSTYPE" == "darwin"* ]]; then
      open -a Docker >/dev/null 2>&1 || true
      for i in {1..15}; do
        if docker info >/dev/null 2>&1; then
          started=true
          break
        fi
        sleep 1
      done
    elif [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "linux"* ]]; then
      if command -v systemctl >/dev/null 2>&1 && sudo systemctl start docker >/dev/null 2>&1; then
        started=true
      fi
    fi

    if [ "$started" = "true" ] && docker info >/dev/null 2>&1; then
      check "Docker" "pass" "started successfully"
    else
      check "Docker" "fail" "could not be started automatically — please start Docker Desktop manually."
      env_pass=false
    fi
  else
    check "Docker" "pass"
  fi
fi

# 1c. Check & Fix Port Conflicts
check_and_fix_port() {
  local port="$1" name="$2" service="$3"
  if ss -tlnH | grep -q -E ":$port "; then
    # If the port is mapped by a running Docker container, it's fine
    if docker ps --format '{{.Ports}}' 2>/dev/null | grep -q -E "(0\.0\.0\.0|\[::\]|localhost):$port->"; then
      return 0
    fi

    local pid
    pid=$(lsof -i :"$port" -sTCP:LISTEN -t | head -n1 2>/dev/null || true)
    if [ -z "$pid" ]; then
      pid=$(lsof -i :"$port" -t | head -n1 2>/dev/null || true)
    fi

    local proc="unknown"
    if [ -n "$pid" ]; then
      proc=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
      if [[ "$proc" == *"docker"* ]]; then
        return 0
      fi
    else
      # If we can't find the PID, it's likely a system daemon we don't have access to
      check "Port $port ($name)" "fail" "occupied by a system/native service (PID inaccessible)"
      env_pass=false
      return 0
    fi
    
    # Prompt before killing unless FORCE_KILL is set
    if [ "$FORCE_KILL" = "true" ]; then
      echo -e "  ${INFO} Force-clearing port $port ($name) PID $pid ($proc)..."
    elif [ -t 0 ]; then
      echo -n -e "  ${YELLOW}⚠ Port $port ($name) occupied by native $proc (PID $pid). Kill it? [y/N]: ${NC}"
      # Redirect stdin to terminal to ensure we can read input when running in interactive terminal
      read -r response < /dev/tty || response="n"
      if [[ ! "$response" =~ ^[Yy]$ ]]; then
        check "Port $port ($name)" "fail" "occupied by native $proc (PID $pid)"
        env_pass=false
        return 0
      fi
    else
      check "Port $port ($name)" "fail" "occupied by native $proc (PID $pid) — run with --force to clear"
      env_pass=false
      return 0
    fi

    if [ -n "$service" ] && command -v systemctl >/dev/null 2>&1 && sudo systemctl stop "$service" >/dev/null 2>&1; then
      sleep 1
      if ! ss -tlnH | grep -q -E ":$port "; then
        check "Port $port ($name)" "pass" "freed native service"
        return 0
      fi
    fi
    if sudo kill -9 "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null; then
      sleep 1
      if ! ss -tlnH | grep -q -E ":$port "; then
        check "Port $port ($name)" "pass" "killed conflicting process"
        return 0
      fi
    fi
    check "Port $port ($name)" "fail" "in use by PID $pid"
    env_pass=false
  else
    check "Port $port ($name)" "pass" "free"
  fi
}


if [ "$QUICK_MODE" = "true" ]; then
  check_and_fix_port "$PORT" "Next.js portal" ""
elif [ "$REMOTE_SUPABASE" = "true" ]; then
  check_and_fix_port "$PORT" "Next.js portal" ""
  check_and_fix_port 6379 "Redis" "redis-server"
else
  check_and_fix_port 54322 "Supabase DB" ""
  check_and_fix_port 6379 "Redis" "redis-server"
  check_and_fix_port 54321 "Supabase API" ""
  check_and_fix_port 8000 "Kong Gateway" ""
fi

if [ -d "$REPO_ROOT/node_modules" ]; then
  check "Dependencies" "pass"
else
  echo -e "  ${INFO} Installing dependencies..."
  pnpm install > /dev/null 2>&1 && check "Dependencies" "pass" || { check "Dependencies" "fail"; env_pass=false; }
fi

[ "$env_pass" = false ] && { echo -e "\n  ${RED}Environment checks failed. Aborting.${NC}\n"; exit 1; }

# ── Phase 2: Infrastructure (Supabase) ───────────────────
SUPABASE_REST_URL="$(supabase_rest_url)"

if [ "$QUICK_MODE" = "true" ]; then
  phase 2 "Infrastructure"
  check "Supabase API" "skip" "quick mode"
  check "Database" "skip" "quick mode"
  check "Studio" "skip" "quick mode"
elif [ "$REMOTE_SUPABASE" = "true" ]; then
  phase 2 "Infrastructure"

  if supabase_api_reachable "$SUPABASE_REST_URL"; then
    check "Supabase API" "pass" "$SUPABASE_API_URL"
  else
    check "Supabase API" "fail" "unreachable at $SUPABASE_API_URL"
    exit 1
  fi

  check "Database" "pass" "remote REST API responding"

  check "Studio" "skip" "remote — use Supabase Dashboard"
else
  phase 2 "Infrastructure"

  if curl -fs "$SUPABASE_REST_URL" > /dev/null 2>&1; then
    check "Supabase API" "pass" "http://localhost:54321"
  else
    echo -e "  ${INFO} Starting Supabase (Docker)..."
    cd "$REPO_ROOT/packages/database"
    mkdir -p "$REPO_ROOT/packages/supabase/supabase/migrations"
    cp -r migrations/* "$REPO_ROOT/packages/supabase/supabase/migrations/" 2>/dev/null || true
    pnpx supabase start > /dev/null 2>&1 &
    SUPAPID=$!
    spinner "$SUPAPID" "Booting Supabase containers"
    cd "$REPO_ROOT"
    if wait_for "$SUPABASE_REST_URL" "Supabase API" 30; then
      check "Supabase API" "pass" "http://localhost:54321"
    else
      check "Supabase API" "fail" "timed out — check 'docker ps'"
      exit 1
    fi
  fi

  # Verify database connection
  if curl -fs "$SUPABASE_REST_URL" -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q 200; then
    check "Database" "pass" "Postgres responding"
  else
    check "Database" "warn" "API up but unexpected response"
  fi

  # Studio check (local stack only)
  curl -fs "http://127.0.0.1:54323" > /dev/null 2>&1 && check "Studio" "pass" "http://localhost:54323" || check "Studio" "skip" "not required"
fi

if [ "$QUICK_MODE" != "true" ]; then
  # Optional Tools (local or remote Supabase)
  if [ "$START_TOOLS" = "true" ]; then
    if [ -f "$REPO_ROOT/infra/docker/compose.tools.yml" ]; then
      echo -e "  ${INFO} Starting Docker Tools..."
      $COMPOSE_CMD -f "$REPO_ROOT/infra/docker/compose.tools.yml" up -d > /dev/null 2>&1

      local services=("plantcor-redis" "plantcor-prometheus" "plantcor-fuxa")
      for service in "${services[@]}"; do
        printf "  ${CYAN}⏳${NC} Gating on $service health... "
        local attempts=0
        while [ $attempts -lt 30 ]; do
          local status
          status=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "starting")
          if [ "$status" = "healthy" ]; then
            echo -e "${GREEN}healthy${NC}"
            break
          fi
          sleep 2
          ((attempts++))
        done
        if [ $attempts -eq 30 ]; then
          echo -e "${YELLOW}timeout (continuing)${NC}"
        fi
      done
      check "Docker Tools" "pass" "booted"
    else
      check "Docker Tools" "skip" "compose file missing"
    fi
  fi

  # Redis — isolated offload stack (redis/) or existing native listener
  REDIS_REQUIRED=true
  if [ "$REDIS_REQUIRED" = "true" ]; then
    if redis_reachable "$REDIS_URL"; then
      check "Redis" "pass" "${REDIS_URL} (offload link active)"
    elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "$REDIS_CONTAINER"; then
      check "Redis" "pass" "${REDIS_URL} (container running)"
    elif [ -f "$REDIS_COMPOSE" ]; then
      echo -e "  ${INFO} Starting Redis offload stack (redis/)..."
      $COMPOSE_CMD -f "$REDIS_COMPOSE" up -d > /dev/null 2>&1
      REDIS_HEALTHY=false
      for i in $(seq 1 15); do
        if docker inspect --format='{{.State.Health.Status}}' "$REDIS_CONTAINER" 2>/dev/null | grep -q "healthy"; then
          REDIS_HEALTHY=true
          break
        fi
        if redis_reachable "$REDIS_URL"; then
          REDIS_HEALTHY=true
          break
        fi
        sleep 1
      done
      if [ "$REDIS_HEALTHY" = "true" ]; then
        check "Redis" "pass" "${REDIS_URL} (offload stack started)"
      else
        check "Redis" "warn" "offload stack started but health check pending — run pnpm redis:status"
      fi
    else
      check "Redis" "fail" "redis/docker-compose.yml missing"
      exit 1
    fi
  fi

  # 2c. Open WebUI — launch if tools compose configuration has it
  # if [ -f "$REPO_ROOT/infra/docker/compose.tools.yml" ]; then
  #   if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "plantcor-open-webui"; then
  #     check "Open WebUI" "pass" "http://localhost:3005"
  #   elif grep -q "open-webui:" "$REPO_ROOT/infra/docker/compose.tools.yml" 2>/dev/null; then
  #     echo -e "  ${INFO} Starting Open WebUI (Docker Tools)..."
  #     $COMPOSE_CMD -f "$REPO_ROOT/infra/docker/compose.tools.yml" up -d open-webui > /dev/null 2>&1
  #     for i in $(seq 1 15); do
  #       if docker inspect --format='{{.State.Health.Status}}' plantcor-open-webui 2>/dev/null | grep -q "healthy"; then
  #         break
  #       fi
  #       sleep 1
  #     done
  #     check "Open WebUI" "pass" "http://localhost:3005"
  #   fi
  # fi
fi

# ── Phase 3: Portal (Start + Wait) ────────────────────────
phase 3 "Portal"

if [ "${SKIP_RESTART:-false}" = "true" ]; then
  check "Dev server" "pass" "http://localhost:$PORT (already up)"
else
  cd "$REPO_ROOT/apps/portal"
  PORT=$PORT NODE_OPTIONS="${NODE_OPTIONS:- --max-old-space-size=4096}" pnpm dev > "$REPO_ROOT/run/portal.log" 2>&1 &
  echo $! > "$REPO_ROOT/run/.portal.pid"
  cd "$REPO_ROOT"
  echo -e "  ${INFO} Starting Next.js dev server..."

  compiled=false
  for i in $(seq 1 120); do
    if curl -fs "http://localhost:$PORT/login" -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q 200; then
      compiled=true
      break
    fi
    if grep -qiE "Failed to compile|Module not found|Cannot find module" "$REPO_ROOT/run/portal.log" 2>/dev/null; then
      break
    fi
    sleep 2
  done

  if [ "$compiled" = "true" ]; then
    date +%s > "$REPO_ROOT/run/.portal.start"
    check "Dev server" "pass" "http://localhost:$PORT (compiled)"
  else
    check "Dev server" "fail"
    echo -e "\n  ${RED}Last 20 lines of portal.log:${NC}"
    tail -20 "$REPO_ROOT/run/portal.log" 2>/dev/null | sed 's/^/  /'
    exit 1
  fi
fi

# ── Phase 3b: Additional Apps (CMS / Overview) ────────────
phase "3b" "Additional Apps"

start_extra_app() {
  local app="$1" dir="$2" port="$3" logfile="$4" pidfile="$5" label="$6"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    check "$label" "pass" "http://localhost:$port (already up)"
    return
  fi
  cd "$dir"
  PORT=$port pnpm dev > "$logfile" 2>&1 &
  echo $! > "$pidfile"
  cd "$REPO_ROOT"
  local ready=false
  for i in $(seq 1 60); do
    if curl -fs "http://localhost:$port" -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q 200; then
      ready=true
      break
    fi
    sleep 2
  done
  if [ "$ready" = "true" ]; then
    check "$label" "pass" "http://localhost:$port (compiled)"
  else
    check "$label" "warn" "startup timed out — check logs"
  fi
}

if [ "$START_CMS" = "true" ]; then
  start_extra_app \
    "cms" "$REPO_ROOT/apps/cms" "3001" \
    "$REPO_ROOT/run/cms.log" "$REPO_ROOT/run/.cms.pid" "CMS"
fi

if [ "$START_OVERVIEW" = "true" ]; then
  start_extra_app \
    "overview" "$REPO_ROOT/apps/overview" "3002" \
    "$REPO_ROOT/run/overview.log" "$REPO_ROOT/run/.overview.pid" "Overview"
fi

if [ "$START_CMS" != "true" ] && [ "$START_OVERVIEW" != "true" ]; then
  check "Extra apps" "skip" "use --cms, --overview, or --all"
fi

# ── Phase 4: Smoke Tests ─────────────────────────────────
phase 4 "Smoke Tests"

# 4a. Health endpoint
if curl -fs "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
  check "Health API" "pass" "/api/health"
else
  check "Health API" "warn" "no /api/health endpoint"
fi

# 4b. Login page loads
if curl -fs "http://localhost:$PORT/login" > /dev/null 2>&1; then
  check "Login page" "pass" "/login"
else
  check "Login page" "warn" "root page available instead"
fi

# 4c. Login page renders real HTML (not error overlay)
if curl -fs "http://localhost:$PORT/login" 2>/dev/null | grep -qi "<html\|<!doctype" 2>/dev/null; then
  check "HTML render" "pass"
else
  check "HTML render" "warn" "login page may show error overlay"
fi

# 4d. Supabase RLS / anon key check
if [ "$QUICK_MODE" = "true" ]; then
  check "Auth config" "skip" "quick mode"
elif [ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ] || [ -n "${SUPABASE_ANON_KEY:-}" ] \
  || grep -qE '^(NEXT_PUBLIC_)?SUPABASE_ANON_KEY=' "$PORTAL_ENV_LOCAL" "$PORTAL_ENV_FILE" "$REPO_ROOT/.env" 2>/dev/null; then
  check "Auth config" "pass" "anon key present"
else
  check "Auth config" "warn" "no SUPABASE_ANON_KEY in portal .env"
fi

# 4e. Static assets accessible
if curl -fs "http://localhost:$PORT/favicon.ico" > /dev/null 2>&1; then
  check "Static assets" "pass"
else
  check "Static assets" "skip"
fi

# 4f. FUXA SCADA health check
FUXA_URL="${NEXT_PUBLIC_FUXA_URL:-http://localhost:1881}"
if curl -fs "$FUXA_URL" > /dev/null 2>&1; then
  check "FUXA SCADA" "pass" "$FUXA_URL"
else
  check "FUXA SCADA" "warn" "$FUXA_URL not reachable (SCADA degraded mode will activate)"
fi

# ── Done ─────────────────────────────────────────────────
show_results

# ── E2E Test Runner ─────────────────────────
if [ "$RUN_E2E" = "true" ]; then
  phase "E2E" "Playwright Tests"
  echo -e "  ${INFO} Seeding E2E test data..."
  bash "$REPO_ROOT/scripts/seed-e2e.sh"
  echo -e "  ${INFO} Running Playwright E2E tests..."
  cd "$REPO_ROOT"
  if [ -f "e2e/.auth/user.json" ]; then
    rm -f "e2e/.auth/user.json"
    check "Auth cache" "pass" "cleared for fresh session"
  fi
  pnpm test:e2e
  E2E_EXIT=$?
  if [ $E2E_EXIT -eq 0 ]; then
    check "E2E tests" "pass" "all passed"
  else
    check "E2E tests" "fail" "exit code $E2E_EXIT — check above for failures"
  fi
fi

open_browser
launch_status_terminal
wait
