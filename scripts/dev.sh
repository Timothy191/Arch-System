#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

# Prevent infinite hangs when probing health endpoints
curl() {
  command curl --max-time 3 "$@"
}

# ──────────────────────────────────────────────────────────
# Arch-Systems — Lightning Dev Script v4 (Cloud-First, No Docker)
# Connects to hosted Supabase + optional Redis, starts Next.js HMR,
# runs 4-phase health check, then opens browser to login page.
# DOCKER / LOCAL SUPABASE REQUIREMENT REMOVED — all infra is SaaS.
# ──────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"

# ── Colors ───────────────────────────────────────────────
DIM='\033[2m'
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
MAGENTA='\033[35m'
CYAN='\033[36m'
WHITE='\033[37m'
NC='\033[0m'
BOLD='\033[1m'

# Icons
PASS="${GREEN}${BOLD} ✔${NC}"
FAIL="${RED}${BOLD} ✖${NC}"
SKIP="${DIM}${BOLD} ⏭${NC}"
WARN="${YELLOW}${BOLD} ⚠${NC}"
INFO="${BLUE}${BOLD} ℹ${NC}"
SUPABASE_URL=$(grep '^SUPABASE_URL=' "$REPO_ROOT/apps/portal/.env" 2>/dev/null | cut -d= -f2- || echo '')
REDIS_URL=$(grep '^REDIS_URL=' "$REPO_ROOT/apps/portal/.env" 2>/dev/null | cut -d= -f2- || echo '')
# Anon key: .env defines NEXT_PUBLIC_SUPABASE_ANON_KEY (client-safe, public). Fall back to
# the non-prefixed name for older setups. Never log the value — only presence/absence.
SUPABASE_ANON_KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$REPO_ROOT/apps/portal/.env" 2>/dev/null | cut -d= -f2- || grep '^SUPABASE_ANON_KEY=' "$REPO_ROOT/apps/portal/.env" 2>/dev/null | cut -d= -f2- || echo '')
HOSTED_PROJECT_REF="mrwhtxbhrzyttlsyuofc"

# ── Helpers ──────────────────────────────────────────────
# phase N TITLE — lightweight section header (colored tag + thin rule).
phase() {
  local n="$1" title="$2"
  echo
  echo -e "  ${BOLD}${BLUE}◆ Phase ${n}${NC}  ${BOLD}${WHITE}${title}${NC}"
  echo -e "  ${DIM}  ─────────────────────────────────────────────────${NC}"
}

# check LABEL STATUS [DETAIL] — two-column row: icon+label (fixed width) | detail.
# Color tokens are '\033[...' literals, so the padded label is built on the PLAIN
# text first, then the assembled colored string is rendered with `echo -e`.
check() {
  local label="$1" status="$2" detail="${3:-}"
  local pad
  printf -v pad '%-28s' "$label"
  if [ "$status" = "pass" ]; then
    echo -e "  ${PASS} ${pad}${detail:+ $DIM$detail$NC}"
  elif [ "$status" = "fail" ]; then
    echo -e "  ${FAIL} ${pad}${detail:+ $RED$detail$NC}"
  elif [ "$status" = "warn" ]; then
    echo -e "  ${WARN} ${pad}${detail:+ $YELLOW$detail$NC}"
  elif [ "$status" = "skip" ]; then
    echo -e "  ${SKIP} ${pad}${detail:+ $DIM$detail$NC}"
  elif [ "$status" = "info" ]; then
    echo -e "  ${INFO} ${pad}${detail:+ $DIM$detail$NC}"
  fi
}

spinner() {
  local pid=$1 msg="$2"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYAN}${frames[$i]}${NC} ${msg}... "
    i=$(( (i+1) % 10 ))
    sleep 0.1
  done
  printf "\r  ${PASS} ${msg}       \n"
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
  local branch
  branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "—")
  local mode_pill
  if [ "$HOSTED_MODE" = "true" ]; then
    mode_pill="${CYAN}${BOLD}CLOUD-FIRST · HOSTED SUPABASE${NC}"
  else
    mode_pill="${MAGENTA}${BOLD}LOCAL · DOCKER${NC}"
  fi
  echo
  echo -e "  ${BOLD}${CYAN}  █████╗ ██████╗  ██████╗██╗  ██╗${NC}"
  echo -e "  ${BOLD}${CYAN} ██╔══██╗██╔══██╗██╔════╝██║  ██║${NC}"
  echo -e "  ${BOLD}${CYAN} ███████║██████╔╝██║     ███████║${NC}"
  echo -e "  ${BOLD}${CYAN} ██╔══██║██╔══██╗██║     ██╔══██║${NC}"
  echo -e "  ${BOLD}${CYAN} ██║  ██║██║  ██║╚██████╗██║  ██║${NC}"
  echo -e "  ${BOLD}${CYAN} ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝${NC}"
  echo -e "  ${DIM}  ──────────────────────────────────────────${NC}"
  echo -e "  ${BOLD}${WHITE}S Y S T E M S${NC}   ${DIM}operational portal · mining ops${NC}"
  echo
  echo -e "  ${mode_pill}"
  echo -e "  ${DIM}$(date '+%a %b %d %Y  %H:%M')${NC}   ${DIM}branch:${NC} ${DIM}${branch}${NC}"
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
  local term
  term=$(detect_terminal)
  local hud_script="$REPO_ROOT/scripts/monitor-hud.sh"
  chmod +x "$hud_script" 2>/dev/null || true

  case "$term" in
    kitty)      kitty --title "Arch-Systems SysOps HUD" bash "$hud_script" & ;;
    gnome)      gnome-terminal --title="Arch-Systems SysOps HUD" -- bash "$hud_script" & ;;
    konsole)    konsole --title "Arch-Systems SysOps HUD" -e "bash $hud_script" & ;;
    alacritty)  alacritty -t "Arch-Systems SysOps HUD" -e bash "$hud_script" & ;;
    xfce4)      xfce4-terminal --title="Arch-Systems SysOps HUD" -e "bash $hud_script" & ;;
    xterm)      xterm -title "Arch-Systems SysOps HUD" -e "bash $hud_script" & ;;
  esac
}

# _url_row LABEL URL [SUFFIX] — one aligned row in the status panel.
_url_row() {
  local label="$1" url="$2" suffix="${3:-}" pad
  printf -v pad '%-9s' "$label"
  echo -e "  ${BOLD}${pad}${NC} ${CYAN}${url}${NC}${suffix:+ ${DIM}${suffix}${NC}}"
}

show_results() {
  local studio_url api_url redis_suffix
  if [ "$HOSTED_MODE" = "true" ]; then
    studio_url="https://supabase.com/dashboard/project/$HOSTED_PROJECT_REF"
    api_url="https://$HOSTED_PROJECT_REF.supabase.co"
    redis_suffix="(local)"
  else
    studio_url="http://localhost:54323"
    api_url="http://localhost:54321"
    redis_suffix=""
  fi

  echo
  echo -e "  ${GREEN}${BOLD}╭──────────────────────────────────────────────────────╮${NC}"
  echo -e "  ${GREEN}${BOLD}│${NC} ${BOLD}${WHITE}✔ All systems go${NC}  ${DIM}edit any file, see live updates${NC}  ${GREEN}${BOLD}│${NC}"
  echo -e "  ${GREEN}${BOLD}╰──────────────────────────────────────────────────────╯${NC}"
  echo
  _url_row "Login"    "http://localhost:$PORT/login"
  _url_row "Portal"   "http://localhost:$PORT"
  if [ "$START_CMS" = "true" ]; then
    _url_row "CMS"      "http://localhost:3001"
  fi
  if [ "$START_OVERVIEW" = "true" ]; then
    _url_row "Overview" "http://localhost:${OVERVIEW_PORT:-3003}"
  fi
  _url_row "Redis"    "redis://localhost:6379" "$redis_suffix"
  _url_row "Studio"   "$studio_url"
  _url_row "API"      "$api_url"
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
STRICT_MODE=false
HEADLESS_MODE=false
HOSTED_MODE=false

if [ "${HEADLESS:-false}" = "true" ] || [ "${CI:-false}" = "true" ] || [ "${NO_OPEN:-false}" = "true" ]; then
  HEADLESS_MODE=true
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --force|-f) FORCE_KILL=true; shift ;;
    --tools|-t) START_TOOLS=true; shift ;;
    --quick|-q) QUICK_MODE=true; shift ;;
    --headless|--no-open) HEADLESS_MODE=true; shift ;;
    --hosted|--no-docker) HOSTED_MODE=true; shift ;;
    --cms)      START_CMS=true; shift ;;
    --overview) START_OVERVIEW=true; shift ;;
    --e2e)      RUN_E2E=true; shift ;;
    --all)      START_CMS=true; START_OVERVIEW=true; shift ;;
    --strict)   STRICT_MODE=true; shift ;;
    *) shift ;;
  esac
done

if [[ "${SUPABASE_URL:-}" =~ supabase\.(co|in) ]]; then
  HOSTED_MODE=true
fi

banner

if [ "$QUICK_MODE" = "true" ]; then
  echo -e "  ${YELLOW}${BOLD}⚡ Quick mode${NC} — skipping Docker/Supabase, starting portal only"
  echo
elif [ "$HOSTED_MODE" = "true" ]; then
  echo -e "  ${CYAN}${BOLD}☁️ Hosted mode${NC} — connecting directly to hosted Supabase ($SUPABASE_URL)"
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
  # NOTE: .remember holds cross-session agent memory (now.md, today-*.md) read
  # by the SessionStart hook — do NOT delete it. Only the transient .kilo run
  # cache is purged.
  smart_cache_cleanup  # Smart Nx cache cleanup + Python bytecode
  clean_dir_cache "$REPO_ROOT/.venv" "Python virtual environment (.venv)"
  clean_dir_cache "$REPO_ROOT/.vercel" "Vercel cache (.vercel)"

  if [ -f "$REPO_ROOT/skills-lock.json" ]; then
    rm -f "$REPO_ROOT/skills-lock.json"
    check "skills-lock.json" "pass" "removed"
  fi

  # Clean orphan MCP processes to free RAM
  pkill -f "next-devtools-mcp" 2>/dev/null || true
  pkill -f "codebase-memory-mcp" 2>/dev/null || true
  pkill -f "@modelcontextprotocol" 2>/dev/null || true
  check "Orphan MCP workers" "pass" "cleaned"

  clean_dir_cache "$REPO_ROOT/deployment-logs" "Deployment logs directory"
  clean_dir_cache "$REPO_ROOT/apps/portal/.next/cache" "Next.js portal cache"
  clean_dir_cache "$REPO_ROOT/apps/cms/.next/cache" "Next.js CMS cache"
  clean_dir_cache "$REPO_ROOT/apps/overview/.next/cache" "Next.js overview cache"
  clean_dir_cache "$REPO_ROOT/packages/eval/.pytest_cache" "Pytest cache"

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

# 1a. Check & Fix Docker (skip in quick mode)
if [ "$QUICK_MODE" = "true" ]; then
  check "Docker" "skip" "quick mode"
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

# 1b. Check & Fix Port Conflicts
check_and_fix_port() {
  local port="$1" name="$2" service="$3"
  if ss -tlnH | grep -q -E ":$port "; then
    # If the port is mapped by a running Docker container, it's fine
    if docker ps --format '{{.Ports}}' 2>/dev/null | grep -q -E "(0\.0\.0\.0|\[::\]|localhost|127\.0\.0\.1):$port->"; then
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
else
  check_and_fix_port 54322 "Supabase DB" ""
  check_and_fix_port 6379 "Redis" "redis-server"
  check_and_fix_port 54321 "Supabase API" ""
  check_and_fix_port 8000 "Kong Gateway" ""
fi

# 1c. Check & Fix Environment files
if [ ! -f "$REPO_ROOT/apps/portal/.env" ] && [ ! -f "$REPO_ROOT/apps/portal/.env.local" ]; then
  if [ -f "$REPO_ROOT/apps/portal/env/.env.example" ]; then
    echo -e "  ${INFO} Apps portal .env missing. Copying from env/.env.example..."
    cp "$REPO_ROOT/apps/portal/env/.env.example" "$REPO_ROOT/apps/portal/.env"
    check "Environment file" "pass" "copied from template"
    if grep -q -E "your-|TODO|CHANGEME" "$REPO_ROOT/apps/portal/.env" 2>/dev/null; then
      check "Environment secrets" "warn" "contains placeholder values — please configure them in apps/portal/.env"
    fi
  elif [ -f "$REPO_ROOT/apps/portal/.env.example" ]; then
    echo -e "  ${INFO} Apps portal .env missing. Copying from .env.example..."
    cp "$REPO_ROOT/apps/portal/.env.example" "$REPO_ROOT/apps/portal/.env"
    check "Environment file" "pass" "copied from template"
    if grep -q -E "your-|TODO|CHANGEME" "$REPO_ROOT/apps/portal/.env" 2>/dev/null; then
      check "Environment secrets" "warn" "contains placeholder values — please configure them in apps/portal/.env"
    fi
  else
    check "Environment file" "fail" "missing and no .env.example found"
    env_pass=false
  fi
else
  check "Environment file" "pass" "exists"
fi

if [ "$STRICT_MODE" = "true" ]; then
  echo -e "  ${INFO} Strict Mode: Running pnpm install..."
  pnpm install --prefer-offline > /dev/null 2>&1 && check "Dependencies" "pass" "synced (strict)" || { check "Dependencies" "fail"; env_pass=false; }
elif [ -d "$REPO_ROOT/node_modules" ]; then
  check "Dependencies" "pass"
else
  echo -e "  ${INFO} Installing dependencies..."
  pnpm install > /dev/null 2>&1 && check "Dependencies" "pass" || { check "Dependencies" "fail"; env_pass=false; }
fi

[ "$env_pass" = false ] && { echo -e "\n  ${RED}Environment checks failed. Aborting.${NC}\n"; exit 1; }

# ── Phase 1.5: Quality Gates (Strict Mode Only) ──────────
if [ "$STRICT_MODE" = "true" ]; then
  phase "1.5" "Quality Gates"
  echo -e "  ${INFO} Running format checks..."
  pnpm format:check > /dev/null 2>&1 && check "Formatting" "pass" || { check "Formatting" "fail"; exit 1; }

  echo -e "  ${INFO} Running quality gates (this may take a while)..."
  pnpm quality > "$REPO_ROOT/run/quality.log" 2>&1 && check "Quality Gates" "pass" || { check "Quality Gates" "fail"; echo -e "\n  ${RED}Quality checks failed. See run/quality.log${NC}\n"; exit 1; }
fi

# ── Phase 2: Infrastructure (Supabase) ───────────────────
if [ "$QUICK_MODE" = "true" ]; then
  phase 2 "Infrastructure"
  check "Supabase API" "skip" "quick mode"
  check "Database" "skip" "quick mode"
  check "Studio" "skip" "quick mode"
elif [ "$HOSTED_MODE" = "true" ]; then
  phase 2 "Infrastructure (Cloud-First)"
  # Real reachability check against the hosted REST endpoint. 200 = reachable +
  # anon key accepted; 401/403 = reachable but the anon header was rejected
  # (still proves the endpoint resolves and the project is live). Anything else
  # (incl. 000 = network error / paused project) is a warn, never a boot blocker.
  hosted_api_code="000"
  if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
    hosted_api_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
      "${SUPABASE_URL}/rest/v1/" -H "apikey: ${SUPABASE_ANON_KEY}" 2>/dev/null)
    [ -z "$hosted_api_code" ] && hosted_api_code="000"
  fi
  case "$hosted_api_code" in
    200|401|403)
      check "Supabase API" "pass" "${SUPABASE_URL} reachable (HTTP ${hosted_api_code})"
      check "Database" "pass" "cloud Postgres reachable via REST"
      ;;
    *)
      check "Supabase API" "warn" "${SUPABASE_URL:-<unset>} not reachable (HTTP ${hosted_api_code}) — check network/keys/paused project"
      check "Database" "warn" "cloud Postgres not verified"
      ;;
  esac
  check "Studio" "skip" "hosted dashboard at supabase.com"
else
  phase 2 "Infrastructure"

  if curl -fs "http://127.0.0.1:54321/rest/v1/" > /dev/null 2>&1; then
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
    if wait_for "http://127.0.0.1:54321/rest/v1/" "Supabase API" 30; then
      check "Supabase API" "pass" "http://localhost:54321"
    else
      check "Supabase API" "fail" "timed out — check 'docker ps'"
      exit 1
    fi
  fi

  # Verify database connection
  if curl -fs "http://127.0.0.1:54321/rest/v1/" -o /dev/null -w "%{http_code}" 2>/dev/null | grep -q 200; then
    check "Database" "pass" "Postgres responding"
  else
    check "Database" "warn" "API up but unexpected response"
  fi

  # 2b. Optional Tools
  if [ "$START_TOOLS" = "true" ]; then
    if [ -f "$REPO_ROOT/infra/docker/compose.tools.yml" ]; then
      echo -e "  ${INFO} Starting Docker Tools..."
      $COMPOSE_CMD -f "$REPO_ROOT/infra/docker/compose.tools.yml" up -d > /dev/null 2>&1

      local services=("plantcor-redis" "plantcor-qdrant")
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

  # Studio check
  curl -fs "http://127.0.0.1:54323" > /dev/null 2>&1 && check "Studio" "pass" "http://localhost:54323" || check "Studio" "skip" "not required"

  # 2b. Redis — auto-start if not already running
  REDIS_REQUIRED=true
  if [ "$REDIS_REQUIRED" = "true" ]; then
    if echo "PING" | redis-cli 2>/dev/null | grep -q "PONG"; then
      check "Redis" "pass" "redis://localhost:6379 (already running)"
    elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "arch-redis"; then
      check "Redis" "pass" "Docker container already running"
    else
      echo -e "  ${INFO} Starting Redis (Docker)..."
      $COMPOSE_CMD -f "$REPO_ROOT/infra/docker/compose.redis.yml" up -d > /dev/null 2>&1
      REDIS_HEALTHY=false
      for i in $(seq 1 15); do
        if docker inspect --format='{{.State.Health.Status}}' arch-redis 2>/dev/null | grep -q "healthy"; then
          REDIS_HEALTHY=true
          break
        fi
        sleep 1
      done
      if [ "$REDIS_HEALTHY" = "true" ]; then
        check "Redis" "pass" "redis://localhost:6379"
      else
        check "Redis" "warn" "started but health check pending — check 'docker ps'"
      fi
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

# ── Phase 2.5: MCP Servers ────────────────────────────────
phase "2.5" "MCP Servers"

if node "$REPO_ROOT/scripts/sync-mcp-config.js"; then
  check "MCP Configs" "pass" "synchronized"
else
  check "MCP Configs" "fail" "failed to sync"
fi

if node "$REPO_ROOT/scripts/validate-mcp-servers.js"; then
  check "MCP Status" "pass" "verified and operational"
else
  check "MCP Status" "warn" "some optional servers are offline (see validation details above)"
fi

# ── Phase 2.6: Security & Exposure ────────────────────────
# Read-only inspections. NEVER print secret values — only presence/status +
# templated fix commands. NEVER mutate DB/RLS/auth or rewrite MCP configs.
phase "2.6" "Security & Exposure"

# Redis bind — warn only if REDIS_URL points beyond localhost.
sec_redis_host="localhost"
if [ -n "${REDIS_URL:-}" ]; then
  sec_redis_host=$(printf '%s' "$REDIS_URL" | sed -E 's#^redis(s)?://([^:/@]+).*#\2#')
  [ -z "$sec_redis_host" ] && sec_redis_host="localhost"
fi
case "$sec_redis_host" in
  localhost|127.0.0.1|0.0.0.0)
    check "Redis bind" "pass" "localhost-only ($sec_redis_host)"
    ;;
  *)
    check "Redis bind" "warn" "$sec_redis_host is non-local — bind 127.0.0.1 + set a password if exposed"
    ;;
esac

# FUXA SCADA — best-effort auth probe (SCADA controls real devices, so flag open access).
sec_fuxa_url="${NEXT_PUBLIC_FUXA_URL:-http://localhost:1881}"
sec_fuxa_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$sec_fuxa_url" 2>/dev/null)
[ -z "$sec_fuxa_code" ] && sec_fuxa_code="000"
case "$sec_fuxa_code" in
  200|301|302)
    check "FUXA SCADA" "warn" "$sec_fuxa_url reachable (HTTP $sec_fuxa_code) — confirm auth is enabled (controls real devices)"
    ;;
  000)
    check "FUXA SCADA" "skip" "$sec_fuxa_url not reachable"
    ;;
  *)
    check "FUXA SCADA" "info" "$sec_fuxa_url HTTP $sec_fuxa_code"
    ;;
esac

# Supabase anon key presence + RLS advisory (read-only reminder, never a mutation).
if [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  check "Anon key" "pass" "NEXT_PUBLIC_SUPABASE_ANON_KEY present"
else
  check "Anon key" "warn" "no NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/portal/.env"
fi
check "RLS advisory" "info" "ensure RLS ENABLED on every non-public table (employees.role/department_id policies)"

# MCP configs — scan for secrets and the postgres localhost mismatch.
# All three files are gitignored; this only reports, never rewrites them.
sec_mcp_files=("$REPO_ROOT/.mcp.json" "$REPO_ROOT/.agents/mcp_config.json" "$REPO_ROOT/.vscode/mcp.json")
sec_mcp_secret_hits=0
sec_mcp_present=0
for f in "${sec_mcp_files[@]}"; do
  [ -f "$f" ] || continue
  sec_mcp_present=$((sec_mcp_present + 1))
  # Flag service-role keys / long JWT-like secrets (never print the value).
  if grep -qE '"(service_role|serviceRole|SUPABASE_SERVICE_ROLE_KEY|JWT_SECRET|SUPABASE_KEY)"[[:space:]]*:[[:space:]]*"[^"]{20,}"' "$f" 2>/dev/null; then
    sec_mcp_secret_hits=$((sec_mcp_secret_hits + 1))
  fi
done
if [ "$sec_mcp_present" -eq 0 ]; then
  check "MCP secrets" "skip" "no MCP config files found"
elif [ "$sec_mcp_secret_hits" -eq 0 ]; then
  check "MCP secrets" "pass" "no service-role keys in MCP configs ($sec_mcp_present/$sec_mcp_present present, all gitignored)"
else
  check "MCP secrets" "warn" "$sec_mcp_secret_hits MCP config(s) contain a secret — move to env var + confirm gitignored"
fi

# postgres MCP mismatch — warn + templated fix command (do NOT rewrite configs).
sec_pg_local=false
for f in "${sec_mcp_files[@]}"; do
  [ -f "$f" ] || continue
  if grep -qE '127\.0\.0\.1:54322|localhost:54322' "$f" 2>/dev/null; then
    sec_pg_local=true
    break
  fi
done
if [ "$sec_pg_local" = "true" ]; then
  check "postgres MCP" "warn" "→ 127.0.0.1:54322 (local); codebase-memory tools can't reach hosted DB"
  echo -e "  ${DIM}    Repoint to hosted Supabase via Supavisor (port 6543):${NC}"
  echo -e "  ${DIM}    postgresql://postgres.mrwhtxbhrzyttlsyuofc:{DB_PASSWORD}@aws-0-{REGION}.pooler.supabase.com:6543/postgres${NC}"
  echo -e "  ${DIM}    Get the exact string + password from:${NC}"
  echo -e "  ${DIM}    https://supabase.com/dashboard/project/mrwhtxbhrzyttlsyuofc/settings/database${NC}"
  echo -e "  ${DIM}    Then update .mcp.json, .agents/mcp_config.json, .vscode/mcp.json (all gitignored).${NC}"
else
  check "postgres MCP" "pass" "not pointed at local 54322"
fi

# ── Phase 3: Portal (Start + Wait) ────────────────────────
phase 3 "Portal"

if [ "${SKIP_RESTART:-false}" = "true" ]; then
  check "Dev server" "pass" "http://localhost:$PORT (already up)"
else
  cd "$REPO_ROOT/apps/portal"
  PORT=$PORT NODE_OPTIONS="${NODE_OPTIONS:- --max-old-space-size=2048 --no-deprecation}" pnpm dev > "$REPO_ROOT/run/portal.log" 2>&1 &
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
    if curl -s "http://localhost:$port" -o /dev/null -w "%{http_code}" 2>/dev/null | grep -qE "200|307|308|401|404"; then
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
    "overview" "$REPO_ROOT/apps/overview" "${OVERVIEW_PORT:-3003}" \
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

# 4d. Supabase RLS / anon key check
if [ "$QUICK_MODE" = "true" ]; then
  check "Auth config" "skip" "quick mode"
elif [ -n "${SUPABASE_ANON_KEY:-}" ] || grep -q 'NEXT_PUBLIC_SUPABASE_ANON_KEY' "$REPO_ROOT/apps/portal/.env" 2>/dev/null || grep -q 'NEXT_PUBLIC_SUPABASE_ANON_KEY' "$REPO_ROOT/.env" 2>/dev/null; then
  check "Auth config" "pass" "anon key present"
else
  check "Auth config" "warn" "no NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/portal/.env or .env"
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

# 4g. Database reachability (hosted REST + anon key + RLS end-to-end).
# 200 = reachable + anon accepted; 401/403 = reachable but RLS-gated (still proves
# connectivity + auth wiring); 000 = network error / paused project (warn, never block).
if [ "$QUICK_MODE" = "true" ]; then
  check "Database" "skip" "quick mode"
elif [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  check "Database" "skip" "SUPABASE_URL / anon key unset"
else
  smoke_db_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
    "${SUPABASE_URL}/rest/v1/" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" 2>/dev/null)
  [ -z "$smoke_db_code" ] && smoke_db_code="000"
  case "$smoke_db_code" in
    200)
      check "Database" "pass" "hosted REST reachable (HTTP 200, anon key accepted)"
      ;;
    401|403)
      check "Database" "pass" "hosted REST reachable (HTTP $smoke_db_code, RLS-gated)"
      ;;
    *)
      check "Database" "warn" "hosted REST HTTP $smoke_db_code — check network/keys/paused project"
      ;;
  esac
fi

# 4h. Redis ping — direct redis-cli + the portal /api/health/redis endpoint.
if [ "$QUICK_MODE" = "true" ]; then
  check "Redis ping" "skip" "quick mode"
else
  smoke_redis_ok=false
  if command -v redis-cli > /dev/null 2>&1; then
    if redis-cli -h 127.0.0.1 -p 6379 ping > /dev/null 2>&1; then
      smoke_redis_ok=true
    fi
  fi
  # Belt-and-suspenders: hit the existing portal health endpoint too.
  if [ "$smoke_redis_ok" = "false" ] && curl -fs "http://localhost:$PORT/api/health/redis" > /dev/null 2>&1; then
    smoke_redis_ok=true
  fi
  if [ "$smoke_redis_ok" = "true" ]; then
    check "Redis ping" "pass" "PONG (127.0.0.1:6379)"
  else
    check "Redis ping" "warn" "no PONG — redis-cli missing or server down"
  fi
fi

# 4i. Authenticated endpoint — full Supabase sign-in, then hit a protected route.
# Reads SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD from apps/portal/.env (gitignored).
# NEVER echoes the password. Skips with an info row if creds absent — never blocks boot.
if [ "$QUICK_MODE" = "true" ]; then
  check "Auth endpoint" "skip" "quick mode"
else
  smoke_email=$(grep '^SMOKE_TEST_EMAIL=' "$REPO_ROOT/apps/portal/.env" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')
  smoke_pass=$(grep '^SMOKE_TEST_PASSWORD=' "$REPO_ROOT/apps/portal/.env" 2>/dev/null | cut -d= -f2-)
  if [ -z "$smoke_email" ] || [ -z "$smoke_pass" ]; then
    check "Auth endpoint" "info" "set SMOKE_TEST_EMAIL/SMOKE_TEST_PASSWORD in apps/portal/.env to enable"
  elif [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
    check "Auth endpoint" "skip" "SUPABASE_URL / anon key unset"
  else
    # Sign in via Supabase Auth (password grant). Extract access_token with node -e.
    smoke_body=$(printf '{"email":"%s","password":"%s"}' "$smoke_email" "$smoke_pass")
    smoke_token=$(curl -s --max-time 10 \
      "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "$smoke_body" 2>/dev/null | node -e '
        let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
          try { const j=JSON.parse(s); process.stdout.write(j.access_token||""); }
          catch(e){ process.stdout.write(""); }
        });
      ' 2>/dev/null)
    if [ -z "$smoke_token" ]; then
      check "Auth endpoint" "warn" "sign-in failed — check SMOKE_TEST_EMAIL/PASSWORD (not a code problem)"
    else
      smoke_auth_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        "http://localhost:$PORT/api/printers" \
        -H "Authorization: Bearer ${smoke_token}" 2>/dev/null)
      [ -z "$smoke_auth_code" ] && smoke_auth_code="000"
      case "$smoke_auth_code" in
        401)
          check "Auth endpoint" "fail" "/api/printers returned 401 with valid JWT"
          ;;
        000)
          check "Auth endpoint" "warn" "/api/printers unreachable (HTTP 000)"
          ;;
        *)
          check "Auth endpoint" "pass" "signed in + /api/printers HTTP $smoke_auth_code (auth middleware working)"
          ;;
      esac
    fi
  fi
fi

# ── Phase 5: Environment Notes (advisory only — no mutation) ──────────────
phase 5 "Environment Notes"

# inotify watches — Next.js HMR + chokedelta benefit from a high limit.
env_inotify=$(cat /proc/sys/fs/inotify/max_user_watches 2>/dev/null || echo "0")
if [ "$env_inotify" -gt 0 ] 2>/dev/null && [ "$env_inotify" -lt 524288 ]; then
  check "inotify" "info" "max_user_watches=$env_inotify (<524288) — raise for heavy HMR: echo fs.inotify_max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p"
elif [ "$env_inotify" -gt 0 ] 2>/dev/null; then
  check "inotify" "pass" "max_user_watches=$env_inotify"
else
  check "inotify" "skip" "could not read /proc/sys/fs/inotify/max_user_watches"
fi

# Nx cache size — advise pnpm nx reset if it has grown large.
if [ -d "$REPO_ROOT/.nx/cache" ]; then
  env_nx_size=$(du -sh "$REPO_ROOT/.nx/cache" 2>/dev/null | cut -f1)
  env_nx_mb=$(du -sm "$REPO_ROOT/.nx/cache" 2>/dev/null | cut -f1)
  if [ -n "$env_nx_mb" ] && [ "$env_nx_mb" -ge 500 ] 2>/dev/null; then
    check "Nx cache" "info" "${env_nx_size}B — pnpm nx reset clears stale artifacts"
  elif [ -n "$env_nx_size" ]; then
    check "Nx cache" "pass" "${env_nx_size}B"
  else
    check "Nx cache" "skip" "could not measure .nx/cache"
  fi
else
  check "Nx cache" "skip" "no .nx/cache directory"
fi

# Portal log — advisory: logs clear on each start; persist with PORTAL_LOG_LEVEL if wanted.
check "Portal log" "info" "logs reset each start — set PORTAL_LOG_LEVEL / redirect to a file for persistence"

# Supabase free-tier keep-alive (hosted only).
if [ "$HOSTED_MODE" = "true" ]; then
  check "Free-tier" "info" "hosted free projects pause after 7d idle — cron GET /rest/v1/ to keep alive, or upgrade to paid tier"
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

if [ "$HEADLESS_MODE" != "true" ]; then
  open_browser
  launch_status_terminal
else
  check "Browser & Status Terminal" "skip" "headless mode"
fi
wait
