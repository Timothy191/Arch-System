#!/usr/bin/env bash
set -euo pipefail

# Arch-Systems — Sequential Stable Deployment Script v2.2
# Usage: ./ops/deploy.sh [local|production|staging] [options]
#
# Features:
#   - Sequential phase execution (waits for each phase to complete 100%)
#   - Kitty terminal monitoring support
#   - Service dependency checks (connect if present, start if not)
#   - Auto-browser open when all services ready
#
# Modes:
#   local       - Full stack with local Supabase (development)
#   staging     - Production-like on staging environment
#   production  - Production deployment (external Supabase)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL_DIR="$REPO_ROOT/apps/portal"
DATABASE_DIR="$REPO_ROOT/pkgs/database"
SUPABASE_DIR="$REPO_ROOT/pkgs/supabase"

# Configuration
PORT="${PORT:-3000}"
DEPLOY_MODE="${1:-local}"
DEPLOY_LOG="$REPO_ROOT/deploy-$(date +%Y%m%d-%H%M%S).log"
LOCK_FILE="$REPO_ROOT/.deploy.lock"
BACKUP_DIR="$REPO_ROOT/.deploy-backups"
PID_FILE="$REPO_ROOT/.deploy-monitor.pid"

# Parse arguments
SKIP_BUILD=false
SKIP_TESTS=false
CLEAN_ONLY=false
DRY_RUN=false
MIGRATE_ONLY=false
ROLLBACK=false
FORCE=false
LIGHTWEIGHT=false
NO_BROWSER=false

for arg in "${@:2}"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --skip-tests) SKIP_TESTS=true ;;
    --clean) CLEAN_ONLY=true ;;
    --dry-run) DRY_RUN=true ;;
    --migrate-only) MIGRATE_ONLY=true ;;
    --rollback) ROLLBACK=true ;;
    --force) FORCE=true ;;
    --lightweight) LIGHTWEIGHT=true ;;
    --no-browser) NO_BROWSER=true ;;
  esac
done

# ── Terminal Detection ────────────────────────────────────
detect_terminal() {
  if command -v kitty > /dev/null 2>&1; then
    echo "kitty"
  elif command -v gnome-terminal > /dev/null 2>&1; then
    echo "gnome"
  elif command -v konsole > /dev/null 2>&1; then
    echo "konsole"
  elif command -v alacritty > /dev/null 2>&1; then
    echo "alacritty"
  elif command -v xfce4-terminal > /dev/null 2>&1; then
    echo "xfce4"
  elif command -v xterm > /dev/null 2>&1; then
    echo "xterm"
  else
    echo "none"
  fi
}

TERMINAL_TYPE=$(detect_terminal)

# ── Colorized Logging ─────────────────────────────────────
colors() {
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  MAGENTA='\033[0;35m'
  NC='\033[0m'
  BOLD='\033[1m'
}
colors

log() {
  local msg="[$(date '+%H:%M:%S')] $*"
  echo -e "${GREEN}[DEPLOY]${NC} $msg"
  echo "$msg" >> "$DEPLOY_LOG" 2>/dev/null || true
}

info() {
  local msg="[$(date '+%H:%M:%S')] $*"
  echo -e "${BLUE}[INFO]${NC} $msg"
  echo "$msg" >> "$DEPLOY_LOG" 2>/dev/null || true
}

warn() {
  local msg="[$(date '+%H:%M:%S')] $*"
  echo -e "${YELLOW}[WARN]${NC} $msg"
  echo "$msg" >> "$DEPLOY_LOG" 2>/dev/null || true
}

phase() {
  local msg="[$(date '+%H:%M:%S')] PHASE: $*"
  echo
  echo -e "${MAGENTA}${BOLD}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${MAGENTA}${BOLD}  $msg${NC}"
  echo -e "${MAGENTA}${BOLD}══════════════════════════════════════════════════════════════${NC}"
  echo
  echo "$msg" >> "$DEPLOY_LOG" 2>/dev/null || true
}

error() {
  local msg="[$(date '+%H:%M:%S')] $*"
  echo -e "${RED}[ERROR]${NC} $msg" >&2
  echo "$msg" >> "$DEPLOY_LOG" 2>/dev/null || true
}

fatal() {
  error "$*"
  cleanup_lock
  exit 1
}

success() {
  local msg="[$(date '+%H:%M:%S')] ✅ $*"
  echo -e "${GREEN}${BOLD}✅ $*${NC}"
  echo "$msg" >> "$DEPLOY_LOG" 2>/dev/null || true
}

# ── Error Collection ────────────────────────────────────
DEPLOY_ERRORS=()

collect_error() {
  local msg="$*"
  DEPLOY_ERRORS+=("$msg")
  error "$msg"
}

report_errors_and_exit() {
  if [ ${#DEPLOY_ERRORS[@]} -eq 0 ]; then
    return 0
  fi

  echo
  echo -e "${RED}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}${BOLD}║           DEPLOYMENT BLOCKED — ERRORS FOUND                  ║${NC}"
  echo -e "${RED}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo
  echo -e "${RED}${BOLD}Found ${#DEPLOY_ERRORS[@]} error(s) — deployment cannot proceed:${NC}"
  echo
  local i=1
  for err in "${DEPLOY_ERRORS[@]}"; do
    echo -e "  ${RED}${BOLD}$i.${NC} ${RED}$err${NC}"
    ((i++))
  done
  echo
  echo -e "${YELLOW}Fix all errors above, then re-run deployment.${NC}"
  echo
  cleanup_lock
  exit 1
}

# ── Lock Management ───────────────────────────────────────
acquire_lock() {
  if [ "$FORCE" = true ]; then
    rm -f "$LOCK_FILE"
  fi
  
  if [ -f "$LOCK_FILE" ]; then
    local pid
    pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$pid" ]; then
      # Check if process exists and is not a zombie
      local proc_stat
      proc_stat=$(ps -o stat= -p "$pid" 2>/dev/null || echo "")
      if [ -n "$proc_stat" ] && [ "$proc_stat" != "Z" ] && [ "$proc_stat" != "Z+" ]; then
        error "Deployment already in progress (PID: $pid, status: $proc_stat)"
        error "Use --force to override or wait for completion"
        exit 1
      fi
      # Zombie or dead process - remove stale lock
      warn "Removing stale lock from dead process (PID: $pid)"
      rm -f "$LOCK_FILE"
    fi
  fi
  echo $$ > "$LOCK_FILE"
}

cleanup_lock() {
  rm -f "$LOCK_FILE"
}

# ── Error Handler ─────────────────────────────────────────
error_trap() {
  local exit_code="$?"
  local line_number="$1"
  local last_command="$2"
  
  echo
  echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║              DEPLOYMENT FAILED - PHASE ABORTED               ║${NC}"
  echo -e "${RED}╠════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${RED}║${NC} Exit code: ${BOLD}$exit_code${NC}"
  echo -e "${RED}║${NC} Line: $line_number"
  echo -e "${RED}║${NC} Command: ${CYAN}$last_command${NC}"
  echo -e "${RED}╠════════════════════════════════════════════════════════════════╣${NC}"
  
  if [[ "$last_command" == *"supabase"* ]]; then
    echo -e "${RED}║${NC} ${YELLOW}→ Check Docker: docker ps | grep supabase${NC}"
    echo -e "${RED}║${NC} ${YELLOW}→ Reset: pnpx supabase stop && pnpx supabase start${NC}"
  elif [[ "$last_command" == *"pnpm"* ]] || [[ "$last_command" == *"build"* ]]; then
    echo -e "${RED}║${NC} ${YELLOW}→ Try: pnpm install && pnpm build${NC}"
    echo -e "${RED}║${NC} ${YELLOW}→ Check: pnpm lint${NC}"
  elif [[ "$last_command" == *"healthcheck"* ]]; then
    echo -e "${RED}║${NC} ${YELLOW}→ Check logs: tail -50 $DEPLOY_LOG${NC}"
    [ -f "$REPO_ROOT/run/portal.log" ] && echo -e "${RED}║${NC} ${YELLOW}→ Portal: tail -50 $REPO_ROOT/run/portal.log${NC}"
  fi
  
  echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo
  
  cleanup_lock
}

trap 'error_trap ${LINENO} "$BASH_COMMAND"' ERR

# ── Dry Run Helper ───────────────────────────────────────
run_if_not_dry() {
  if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}[DRY-RUN]${NC} Would execute: $*"
  else
    "$@"
  fi
}

confirm() {
  if [ "$FORCE" = true ] || [ "$DRY_RUN" = true ]; then
    return 0
  fi
  echo
  echo -e "${YELLOW}⚠️  DEPLOYMENT CONFIRMATION${NC}"
  echo -e "${YELLOW}   Target:${NC} ${BOLD}$DEPLOY_MODE${NC}"
  echo -e "${YELLOW}   This will execute sequentially:${NC}"
  echo "   1. Port conflict check & cleanup"
  echo "   2. Environment validation"
  echo "   3. Create backup (production)"
  echo "   4. Stop existing services"
  echo "   5. Build application"
  echo "   6. Start infrastructure (Supabase, Docker)"
  echo "   7. Run database migrations"
  echo "   8. Deploy portal"
  echo "   9. Running tests"
  echo "   10. Launch monitoring terminal"
  echo "   11. Open browser"
  echo
  read -rp "Continue? [y/N] " response
  [[ "$response" =~ ^[Yy]$ ]] || exit 0
}

# ── Health Check ─────────────────────────────────────────
healthcheck() {
  local url="$1"
  local max_attempts="${2:-60}"
  local service_name="${3:-service}"
  local delay="${4:-2}"
  
  if [ "$DRY_RUN" = true ]; then
    success "$service_name is healthy (dry-run)"
    return 0
  fi
  
  info "Health checking $service_name at $url (max ${max_attempts}s)..."
  
  for i in $(seq 1 $max_attempts); do
    if curl -fs "$url" > /dev/null 2>&1; then
      success "$service_name is healthy"
      return 0
    fi
    
    if [ $((i % 5)) -eq 0 ]; then
      echo -n "⏳ "
    fi
    
    sleep $delay
  done
  
  fatal "$service_name failed health check after ${max_attempts} attempts"
}

# ── Docker Compose Helper ──────────────────────────────
detect_compose_cmd() {
  # Try docker compose (plugin) first, then docker-compose (legacy)
  if docker compose version > /dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose > /dev/null 2>&1; then
    echo "docker-compose"
  else
    echo "docker compose"
  fi
}

COMPOSE_CMD=$(detect_compose_cmd)

# Enforce BuildKit so Dockerfile RUN --mount=type=cache instructions work.
# DOCKER_BUILDKIT=1 enables BuildKit. COMPOSE_DOCKER_CLI_BUILD=1 is required
# for docker-compose (standalone binary) to pass BuildKit through to the
# Docker CLI. COMPOSE_BAKE=true is the equivalent for the docker compose
# (plugin) variant.
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export COMPOSE_BAKE=true

# ── Service Status Checkers ─────────────────────────────
is_supabase_running() {
  curl -fs "http://127.0.0.1:54321/rest/v1/" > /dev/null 2>&1
}

is_docker_tool_running() {
  local service="$1"
  docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${service}$"
}

is_portal_running() {
  curl -fs "http://localhost:$PORT" > /dev/null 2>&1
}

# ── Pre-Flight: Collect-All Validation ─────────────────
validate_prerequisites() {
  phase "0. PRE-FLIGHT VALIDATION"
  DEPLOY_ERRORS=()

  log "Checking Node.js..."
  local node_version
  node_version=$(node -v 2>/dev/null | sed 's/v//' || echo "0.0.0")
  if [ "$(printf '%s\n' "20.17.0" "$node_version" | sort -V | head -n1)" != "20.17.0" ]; then
    collect_error "Node.js >= 20.17.0 required. Found: $node_version"
  else
    success "Node.js v$node_version"
  fi

  log "Checking pnpm..."
  if ! command -v pnpm > /dev/null 2>&1; then
    collect_error "pnpm not found. Install: npm install -g pnpm@9.12.0"
  else
    success "pnpm $(pnpm -v)"
  fi

  log "Checking Docker..."
  if ! docker info > /dev/null 2>&1; then
    if [ "$DEPLOY_MODE" = "local" ]; then
      collect_error "Docker is not running. Start Docker Desktop/Daemon manually."
    else
      warn "Docker not available (non-critical for remote deploy)"
    fi
  else
    success "Docker OK"
  fi

  log "Checking Git repository..."
  if [ ! -d "$REPO_ROOT/.git" ]; then
    collect_error "Not a git repository: $REPO_ROOT"
  else
    success "Git repository OK"
  fi

  log "Checking required directories..."
  [ ! -d "$PORTAL_DIR" ] && collect_error "Portal directory missing: $PORTAL_DIR"
  [ ! -d "$DATABASE_DIR" ] && collect_error "Database directory missing: $DATABASE_DIR"
  [ ! -d "$DATABASE_DIR/migrations" ] && collect_error "Migrations directory missing"
  if [ ${#DEPLOY_ERRORS[@]} -eq 0 ]; then
    success "Required directories OK"
  fi

  # Environment validation
  log "Checking environment files..."
  case "$DEPLOY_MODE" in
    production)
      if [ ! -f "$PORTAL_DIR/.env" ]; then
        collect_error "Production .env not found at $PORTAL_DIR/.env"
      else
        local supa_url
        supa_url=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$PORTAL_DIR/.env" | cut -d= -f2- | tr -d '"' || true)
        if [ -z "$supa_url" ]; then
          collect_error "NEXT_PUBLIC_SUPABASE_URL not set in .env"
        elif [[ "$supa_url" == *localhost* ]] || [[ "$supa_url" == *127.0.0.1* ]]; then
          collect_error "Production requires non-localhost Supabase URL"
        fi
      fi
      ;;
    staging)
      if [ ! -f "$PORTAL_DIR/.env.staging" ] && [ ! -f "$PORTAL_DIR/.env" ]; then
        collect_error "Staging .env not found"
      fi
      ;;
    local)
      if [ ! -f "$PORTAL_DIR/.env" ] && [ ! -f "$PORTAL_DIR/.env.local" ]; then
        if [ -f "$PORTAL_DIR/.env.example" ]; then
          log "Apps portal .env missing. Copying from .env.example..."
          run_if_not_dry cp "$PORTAL_DIR/.env.example" "$PORTAL_DIR/.env"
          success "Created .env file from template"
          if grep -q -E "your-|TODO|CHANGEME" "$PORTAL_DIR/.env" 2>/dev/null; then
            warn "Created .env file contains placeholder secrets — verify apps/portal/.env"
          fi
        else
          collect_error "No .env or .env.example found for local deployment"
        fi
      fi
      ;;
  esac

  if [ ${#DEPLOY_ERRORS[@]} -eq 0 ]; then
    success "Environment files OK"
  fi

  log "Checking lock file..."
  if [ ! -f "$REPO_ROOT/pnpm-lock.yaml" ]; then
    collect_error "pnpm-lock.yaml missing — run pnpm install"
  else
    success "Lock file OK"
  fi

  # If any errors collected, report and exit
  report_errors_and_exit
  success "Pre-flight validation passed — all prerequisites ready"
}

# ── Phase 1: Port Conflict Check & Cleanup ─────────────
phase_port_check() {
  phase "1. PORT CONFLICT CHECK & CLEANUP"

  # Port Conflict Resolution (Local Only)
  if [ "$DEPLOY_MODE" = "local" ]; then
    log "Checking for colliding ports..."
    check_and_fix_port() {
      local port="$1" name="$2" service="$3"
      if sudo lsof -i :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid
        pid=$(sudo lsof -i :"$port" -sTCP:LISTEN -t | head -n1)
        local proc
        proc=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
        if [[ "$proc" == *"docker"* ]]; then
          return 0
        fi
        warn "Port $port ($name) occupied by native $proc (PID $pid). Freeing..."
        if [ "$DRY_RUN" = true ]; then
          log "[DRY-RUN] Would attempt to stop native service '$service' or kill process PID $pid"
          success "Freed port $port ($name) (dry-run)"
          return 0
        fi
        
        # Check if we should force or prompt
        if [ "${FORCE:-false}" = "true" ]; then
          log "Force-clearing port $port ($name) PID $pid ($proc)..."
        elif [ -t 0 ]; then
          echo -n -e "  Port $port ($name) occupied by native $proc (PID $pid). Kill it? [y/N]: "
          read -r response < /dev/tty || response="n"
          if [[ ! "$response" =~ ^[Yy]$ ]]; then
            fatal "Port $port ($name) occupied by native $proc (PID $pid). Clear it manually or run with --force."
          fi
        else
          fatal "Port $port ($name) occupied by native $proc (PID $pid) in non-interactive environment — run with --force to clear"
        fi

        if [ -n "$service" ] && command -v systemctl >/dev/null 2>&1 && sudo systemctl stop "$service" >/dev/null 2>&1; then
          sleep 1
          if ! sudo lsof -i :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            success "Freed port $port ($name) by stopping native service"
            return 0
          fi
        fi
        if sudo kill -9 "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null; then
          sleep 1
          if ! sudo lsof -i :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            success "Freed port $port ($name) by killing conflicting process"
            return 0
          fi
        fi
        fatal "Port $port ($name) is locked by PID $pid and could not be freed."
      fi
    }
    check_and_fix_port 5432 "PostgreSQL" "postgresql"
    if [ "${LIGHTWEIGHT:-false}" != "true" ]; then
      check_and_fix_port 6379 "Redis" "redis-server"
    fi
    check_and_fix_port 54321 "Supabase API" ""
    check_and_fix_port 8000 "Kong Gateway" ""
    check_and_fix_port "$PORT" "Portal Dev Server" ""
    success "All port requirements verified and cleared"
  else
    success "Non-local environment — native port checks skipped"
  fi
}

# ── Phase 2: Environment Validation ────────────────────
phase_validate() {
  phase "2. ENVIRONMENT VALIDATION"

  # Pre-flight already ran; do runtime checks only
  log "Checking terminal..."
  if [ "$TERMINAL_TYPE" != "none" ]; then
    success "Terminal: $TERMINAL_TYPE"
  else
    warn "No compatible terminal found for monitoring"
  fi
  
  log "Checking pnpm..."
  if ! command -v pnpm > /dev/null 2>&1; then
    fatal "pnpm not found. Install: npm install -g pnpm@9.12.0"
  fi
  success "pnpm $(pnpm -v)"
  
  log "Checking Docker..."
  if ! docker info > /dev/null 2>&1; then
    if [ "$DEPLOY_MODE" = "local" ]; then
      warn "Docker is not running. Attempting to start docker..."
      if [ "$DRY_RUN" = true ]; then
        log "[DRY-RUN] Would start docker service via systemctl or open Docker Desktop"
        success "Docker started successfully (dry-run)"
      else
        local started=false
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
          success "Docker started successfully"
        else
          fatal "Docker is required for local deployment and could not be started automatically. Please start Docker Desktop/Daemon manually."
        fi
      fi
    else
      warn "Docker not available"
    fi
  else
    success "Docker OK"
  fi
  
  log "Checking terminal..."
  if [ "$TERMINAL_TYPE" != "none" ]; then
    success "Terminal: $TERMINAL_TYPE"
  else
    warn "No compatible terminal found for monitoring"
  fi
  
  # Environment files
  case "$DEPLOY_MODE" in
    production)
      [ ! -f "$PORTAL_DIR/.env" ] && fatal "Production .env not found"
      local supa_url
      supa_url=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$PORTAL_DIR/.env" | cut -d= -f2- | tr -d '"' || true)
      [[ "$supa_url" == *localhost* ]] && fatal "Production requires non-localhost Supabase"
      success "Production .env validated"
      ;;
    staging)
      [ ! -f "$PORTAL_DIR/.env.staging" ] && [ ! -f "$PORTAL_DIR/.env" ] && fatal "Staging .env not found"
      success "Staging .env validated"
      ;;
    local)
      if [ ! -f "$PORTAL_DIR/.env" ] && [ ! -f "$PORTAL_DIR/.env.local" ]; then
        if [ -f "$PORTAL_DIR/.env.example" ]; then
          log "Apps portal .env missing. Copying from .env.example..."
          run_if_not_dry cp "$PORTAL_DIR/.env.example" "$PORTAL_DIR/.env"
          success "Created .env file from template"
          if grep -q -E "your-|TODO|CHANGEME" "$PORTAL_DIR/.env" 2>/dev/null; then
            warn "Created .env file contains placeholder secrets (e.g. your-...). Please verify keys in apps/portal/.env"
          fi
        else
          warn "No .env found - using defaults"
        fi
      else
        success "Local .env found"
      fi
      ;;
  esac
  
  # Pre-launch Project-wide Cache Cleanup
  log "Performing pre-launch project-wide cache cleanup..."
  run_if_not_dry rm -rf "$REPO_ROOT"/.kilo "$REPO_ROOT"/.remember "$REPO_ROOT"/.nx/cache "$REPO_ROOT"/.venv "$REPO_ROOT"/.vercel "$REPO_ROOT"/.vscode "$REPO_ROOT"/skills-lock.json "$REPO_ROOT"/deployment-logs
  run_if_not_dry rm -rf "$REPO_ROOT"/apps/portal/.next/cache "$REPO_ROOT"/apps/cms/.next/cache "$REPO_ROOT"/apps/overview/.next/cache "$REPO_ROOT"/pkgs/eval/.pytest_cache
  run_if_not_dry find "$REPO_ROOT" -type d \( -name node_modules -o -name .next -o -name .nx -o -name .git -o -name .turbo \) -prune -o -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
  
  # Clean old logs and temporary status/monitor scripts, keeping the current DEPLOY_LOG
  if [ -n "${DEPLOY_LOG:-}" ] && [ -f "$DEPLOY_LOG" ]; then
    find "$REPO_ROOT" -maxdepth 1 -name "deploy-*.log" ! -name "$(basename "$DEPLOY_LOG")" -delete 2>/dev/null || true
  else
    find "$REPO_ROOT" -maxdepth 1 -name "deploy-*.log" -delete 2>/dev/null || true
  fi
  run_if_not_dry rm -f "$REPO_ROOT"/portal-*.log "$REPO_ROOT"/.dev-status-*.sh "$REPO_ROOT"/.monitor-*.sh "$REPO_ROOT"/.deploy-results-*.sh
  
  success "Untracked caches, logs, and temporary files cleaned"
  success "Environment validation complete"
}

# ── Phase 2: Backup ────────────────────────────────────
phase_backup() {
  [ "$DEPLOY_MODE" != "production" ] && return 0
  
  phase "3. CREATING BACKUP"
  
  run_if_not_dry mkdir -p "$BACKUP_DIR"
  
  local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
  local backup_path="$BACKUP_DIR/$backup_name"
  
  log "Creating backup: $backup_name"
  
  run_if_not_dry mkdir -p "$backup_path"
  [ -f "$REPO_ROOT/run/.portal.pid" ] && run_if_not_dry cp "$REPO_ROOT/run/.portal.pid" "$backup_path/"
  
  if [ -d "$PORTAL_DIR/.next" ]; then
    run_if_not_dry tar -czf "$backup_path/build.tar.gz" -C "$PORTAL_DIR" .next 2>/dev/null || true
  fi
  
  run_if_not_dry echo "$backup_path" > "$BACKUP_DIR/latest"
  success "Backup created: $backup_name"
}

# ── Phase 3: Stop Services ───────────────────────────────
phase_stop_services() {
  phase "4. STOPPING EXISTING SERVICES"
  
  # Stop portal
  if [ -f "$REPO_ROOT/run/.portal.pid" ]; then
    local pid
    pid=$(cat "$REPO_ROOT/run/.portal.pid" 2>/dev/null || true)
    if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
      log "Stopping portal (PID: $pid)..."
      run_if_not_dry kill -SIGTERM "$pid" 2>/dev/null || true
      sleep 3
      run_if_not_dry kill -9 "$pid" 2>/dev/null || true
    fi
    run_if_not_dry rm -f "$REPO_ROOT/run/.portal.pid"
  fi
  
  # Check if portal still running on port
  if is_portal_running; then
    warn "Portal still responding, forcing port cleanup..."
    local pids
    pids=$(ss -tunlp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K\d+' | sort -u || true)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  fi
  
  # Stop systemd if exists
  if systemctl list-units --type=service 2>/dev/null | grep -q "arch-systems"; then
    log "Stopping systemd service..."
    run_if_not_dry sudo systemctl stop arch-systems 2>/dev/null || true
  fi
  
  # Clean mode stops everything
  if [ "$CLEAN_ONLY" = true ] || [ "$DEPLOY_MODE" = "local" ]; then
    local tools_compose="$REPO_ROOT/infra/docker/compose.tools.yml"
    local monitor_compose="$REPO_ROOT/infra/obs/docker-compose.yml"
    
    if [ -f "$tools_compose" ]; then
      log "Stopping Docker tools..."
      run_if_not_dry $COMPOSE_CMD -f "$tools_compose" down 2>/dev/null || true
    fi
    
    if [ -f "$monitor_compose" ]; then
      log "Stopping monitoring stack..."
      run_if_not_dry $COMPOSE_CMD -f "$monitor_compose" down 2>/dev/null || true
    fi
    
    if [ "$CLEAN_ONLY" = true ]; then
      log "Keeping existing Supabase instance running (as requested)"
    fi
  fi
  
  success "Services stopped"
  sleep 2
}

# ── Phase 4: Build ──────────────────────────────────────
phase_build() {
  [ "$SKIP_BUILD" = true ] && return 0
  
  phase "5. BUILDING APPLICATION"
  
  run_if_not_dry cd "$REPO_ROOT"
  
  log "Installing dependencies..."
  run_if_not_dry pnpm install --frozen-lockfile
  success "Dependencies installed"
  
  log "Building portal..."
  run_if_not_dry pnpm turbo build --filter=portal...
  success "Build complete"
}

# ── Phase 5: Start Infrastructure ───────────────────────
phase_start_infrastructure() {
  phase "6. STARTING INFRASTRUCTURE"
  
  case "$DEPLOY_MODE" in
    local)
      # Supabase
      if is_supabase_running; then
        success "Supabase already running - connecting to existing instance"
      else
        log "Supabase is not running. Attempting to start existing Supabase containers..."
        if docker ps -a --format '{{.Names}}' | grep -q "^supabase_db_supabase$"; then
          run_if_not_dry docker start $(docker ps -a --filter "name=supabase" --format "{{.ID}}")
          healthcheck "http://127.0.0.1:54321/rest/v1/" 60 "Supabase API"
        else
          fatal "Supabase is not running and no existing Supabase containers were found. Please start it first."
        fi
      fi
      
      # Docker tools (skipped in lightweight mode)
      if [ "${LIGHTWEIGHT:-false}" != "true" ]; then
        local tools_compose="$REPO_ROOT/infra/docker/compose.tools.yml"
        if [ -f "$tools_compose" ]; then
          if $COMPOSE_CMD -f "$tools_compose" ps --format '{{.Status}}' 2>/dev/null | grep -q 'Up'; then
            success "Docker tools already running - connecting"
          else
            log "Starting Docker tools (Redis, n8n, Flowise, Langfuse, etc.)..."
            run_if_not_dry $COMPOSE_CMD -f "$tools_compose" up -d || warn "Some Docker tools failed to start (non-critical)"
            
            if [ "$DRY_RUN" = false ]; then
              log "Waiting for Docker tools to report healthy..."
              local services=("plantcor-redis" "plantcor-n8n" "plantcor-flowise" "plantcor-langfuse-db" "plantcor-langfuse" "plantcor-qdrant")
              for service in "${services[@]}"; do
                info "Gating on $service health..."
                local attempts=0
                while [ $attempts -lt 30 ]; do
                  local status
                  status=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "starting")
                  if [ "$status" = "healthy" ]; then
                    success "$service is healthy"
                    break
                  fi
                  sleep 2
                  ((attempts++))
                done
                if [ $attempts -eq 30 ]; then
                  warn "$service health check timed out (continuing anyway)"
                fi
              done
            fi
            success "Docker tools processing complete"
          fi
        fi

        # Monitoring
        local monitor_compose="$REPO_ROOT/infra/obs/docker-compose.yml"
        if [ -f "$monitor_compose" ]; then
          if $COMPOSE_CMD -f "$monitor_compose" ps --format '{{.Status}}' 2>/dev/null | grep -q 'Up'; then
            success "Monitoring already running - connecting"
          else
            log "Starting monitoring (Prometheus, Grafana)..."
            run_if_not_dry $COMPOSE_CMD -f "$monitor_compose" up -d || warn "Some monitoring services failed (non-critical)"
            sleep 3
            success "Monitoring processing complete"
          fi
        fi
      else
        log "Lightweight mode: skipping Docker tools and monitoring"
      fi
      ;;
      
    production|staging)
      local tools_compose="$REPO_ROOT/infra/docker/compose.tools.yml"
      local prod_compose="$REPO_ROOT/infra/docker/compose.production.yml"
      
      if [ -f "$tools_compose" ]; then
        log "Starting production Docker services..."
        if [ -f "$prod_compose" ]; then
          run_if_not_dry $COMPOSE_CMD -f "$tools_compose" -f "$prod_compose" up -d || warn "Some production services failed (non-critical)"
        else
          run_if_not_dry $COMPOSE_CMD -f "$tools_compose" up -d || warn "Some services failed (non-critical)"
        fi
        success "Production services processing complete"
      fi
      ;;
  esac
}

# ── Phase 6: Database Migrations ──────────────────────
phase_migrations() {
  phase "7. DATABASE MIGRATIONS"
  
  case "$DEPLOY_MODE" in
    local)
      success "Local Supabase handles migrations automatically"
      ;;
    staging|production)
      log "Pushing migrations to $DEPLOY_MODE..."
      run_if_not_dry cd "$DATABASE_DIR" && pnpx supabase db push
      success "Migrations complete"
      ;;
  esac
}

# ── Phase 7: Deploy Portal ─────────────────────────────
phase_deploy_portal() {
  phase "8. DEPLOYING PORTAL"
  
  case "$DEPLOY_MODE" in
    local)
      log "Starting portal on port $PORT..."
      run_if_not_dry cd "$PORTAL_DIR"
      
      if [ "$DRY_RUN" = false ]; then
        HOSTNAME=0.0.0.0 PORT=$PORT pnpm start > "$REPO_ROOT/run/portal.log" 2>&1 &
        echo $! > "$REPO_ROOT/run/.portal.pid"
      fi
      
      healthcheck "http://localhost:$PORT" 60 "Portal"
      ;;
      
    production)
      if systemctl list-units --type=service 2>/dev/null | grep -q "arch-systems"; then
        log "Starting via systemd..."
        run_if_not_dry sudo systemctl restart arch-systems
        run_if_not_dry sudo systemctl enable arch-systems
        sleep 3
        
        if ! systemctl is-active --quiet arch-systems; then
          fatal "Systemd service failed to start"
        fi
      else
        log "Starting portal as background process..."
        run_if_not_dry cd "$PORTAL_DIR"
        
        if [ "$DRY_RUN" = false ]; then
          NODE_ENV=production PORT=$PORT pnpm start >> "$REPO_ROOT/run/portal.log" 2>&1 &
          echo $! > "$REPO_ROOT/run/.portal.pid"
        fi
        
        healthcheck "http://localhost:$PORT" 60 "Portal"
      fi
      ;;
      
    staging)
      log "Starting staging portal..."
      run_if_not_dry cd "$PORTAL_DIR"
      
      if [ "$DRY_RUN" = false ]; then
        HOSTNAME=0.0.0.0 PORT=$PORT pnpm start > "$REPO_ROOT/portal-staging.log" 2>&1 &
        echo $! > "$REPO_ROOT/.portal-staging.pid"
      fi
      
      healthcheck "http://localhost:$PORT" 60 "Portal"
      ;;
  esac
  
  success "Portal deployed and healthy"
}

# ── Phase 8: Testing ───────────────────────────────────
phase_testing() {
  [ "$SKIP_TESTS" = true ] && return 0
  
  phase "9. RUNNING TESTS"
  
  run_if_not_dry cd "$REPO_ROOT"
  
  log "Running unit tests..."
  if ! run_if_not_dry pnpm --filter portal test -- --passWithNoTests 2>/dev/null; then
    collect_error "Unit tests failed — fix before deploying"
    report_errors_and_exit
  else
    success "Unit tests passed"
  fi
  
  log "Running health checks..."
  if [ "$DRY_RUN" = true ]; then
    success "Health checks skipped (dry-run)"
    return 0
  fi

  # Structured health endpoint — validate JSON status field
  local health_url="http://localhost:$PORT/api/health"
  local health_status
  health_status=$(curl -fs "$health_url" 2>/dev/null | jq -r '.status // "unknown"')
  if [ "$health_status" = "healthy" ] || [ "$health_status" = "degraded" ]; then
    success "Health API OK (status: $health_status)"
  else
    collect_error "Health API check failed: status='$health_status' at $health_url"
  fi

  # Raw reachability checks
  local endpoints=(
    "http://localhost:$PORT|Portal Root"
    "http://localhost:$PORT/login|Login Page"
    "http://localhost:$PORT/api/health/live|Live Probe"
  )

  for endpoint in "${endpoints[@]}"; do
    local url name
    url=$(echo "$endpoint" | cut -d'|' -f1)
    name=$(echo "$endpoint" | cut -d'|' -f2)

    if curl -fs "$url" > /dev/null 2>&1; then
      success "$name OK"
    else
      collect_error "$name health check failed: $url"
    fi
  done

  report_errors_and_exit
}

# ── Phase 9: Launch Monitoring ─────────────────────────
phase_launch_monitoring() {
  [ "$TERMINAL_TYPE" = "none" ] && return 0
  [ "$DRY_RUN" = true ] && return 0
  
  phase "10. LAUNCHING MONITORING TERMINAL"
  
  # Create monitoring script
  local monitor_script="$REPO_ROOT/.monitor-$$.sh"
  cat > "$monitor_script" << 'EOF'
#!/bin/bash
clear
echo -e "\033[0;35m╔════════════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[0;35m║           ARCH-SYSTEMS DEPLOYMENT MONITOR                      ║\033[0m"
echo -e "\033[0;35m╚════════════════════════════════════════════════════════════════╝\033[0m"
echo ""
echo "Services Status:"
echo "────────────────"

# Check services
if curl -fs http://localhost:3000 > /dev/null 2>&1; then
  echo -e "  🟢 Portal:     http://localhost:3000"
else
  echo -e "  🔴 Portal:     NOT RESPONDING"
fi

if curl -fs http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1; then
  echo -e "  🟢 Supabase:   http://localhost:54321"
else
  echo -e "  ⚪ Supabase:   Not configured"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q redis; then
  echo -e "  🟢 Redis:      Running"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q n8n; then
  echo -e "  🟢 n8n:        http://localhost:5678"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q flowise; then
  echo -e "  🟢 Flowise:    http://localhost:3000"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q prometheus; then
  echo -e "  🟢 Prometheus: http://localhost:9090"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q grafana; then
  echo -e "  🟢 Grafana:    http://localhost:9091"
fi

echo ""
echo -e "\033[0;35m────────────────────────────────────────────────────────────────\033[0m"
echo "Live Logs (Ctrl+C to exit):"
echo ""

# Tail logs
if [ -f DEPLOY_LOG ]; then
  tail -f DEPLOY_LOG portal.log 2>/dev/null | head -100
else
  tail -f portal.log 2>/dev/null
fi
EOF
  chmod +x "$monitor_script"
  
  log "Launching $TERMINAL_TYPE terminal..."
  
  case "$TERMINAL_TYPE" in
    kitty)
      kitty --title "Arch-Systems Monitor" bash "$monitor_script" &
      ;;
    gnome)
      gnome-terminal --title="Arch-Systems Monitor" -- bash "$monitor_script" &
      ;;
    konsole)
      konsole --title "Arch-Systems Monitor" -e "bash $monitor_script" &
      ;;
    alacritty)
      alacritty -t "Arch-Systems Monitor" -e bash "$monitor_script" &
      ;;
    xfce4)
      xfce4-terminal --title="Arch-Systems Monitor" -e "bash $monitor_script" &
      ;;
    xterm)
      xterm -title "Arch-Systems Monitor" -e "bash $monitor_script" &
      ;;
  esac
  
  # Save monitor PID for cleanup
  echo $! > "$PID_FILE"
  sleep 2
  success "Monitoring terminal launched"
}

# ── Phase 10: Show Results & Open Browser ──────────────
phase_results_and_browser() {
  [ "$DRY_RUN" = true ] && return 0
  
  phase "11. DEPLOYMENT RESULTS & BROWSER"
  
  local login_url="http://localhost:$PORT/login"
  
  log "Waiting for services to be fully ready..."
  sleep 3
  
  # Create results script
  local results_script="$REPO_ROOT/.deploy-results-$$.sh"
  cat > "$results_script" << RESULTSEOF
#!/bin/bash
sleep 2
clear
echo -e "\033[0;35m╔════════════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[0;35m║        🎉 ARCH-SYSTEMS DEPLOYMENT COMPLETE 🎉                   ║\033[0m"
echo -e "\033[0;35m╚════════════════════════════════════════════════════════════════╝\033[0m"
echo ""
echo -e "\033[1m📊 Deployment Results Summary\033[0m"
echo "────────────────────────────────────────────────────────────────"
echo ""

# Check each service and show status
if curl -fs http://localhost:$PORT > /dev/null 2>&1; then
  echo -e "  ✅ \033[1mPortal:\033[0m       http://localhost:$PORT"
  echo -e "  ✅ \033[1mLogin Page:\033[0m   http://localhost:$PORT/login"
else
  echo -e "  ❌ \033[1mPortal:\033[0m       FAILED"
fi

if curl -fs http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1; then
  echo -e "  ✅ \033[1mSupabase:\033[0m     http://localhost:54321"
else
  echo -e "  ⚪ \033[1mSupabase:\033[0m     Not running"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q plantcor-n8n; then
  echo -e "  ✅ \033[1mn8n:\033[0m          http://localhost:5678 (user: plantcor)"
else
  echo -e "  ⚪ \033[1mn8n:\033[0m          Not running"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q plantcor-flowise; then
  echo -e "  ✅ \033[1mFlowise:\033[0m      http://localhost:3001 (user: plantcor)"
else
  echo -e "  ⚪ \033[1mFlowise:\033[0m      Not running"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q plantcor-redis; then
  echo -e "  ✅ \033[1mRedis:\033[0m        Port 6379"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q plantcor-grafana; then
  echo -e "  ✅ \033[1mGrafana:\033[0m      http://localhost:9091"
else
  echo -e "  ⚪ \033[1mGrafana:\033[0m      Not running"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q plantcor-prometheus; then
  echo -e "  ✅ \033[1mPrometheus:\033[0m   http://localhost:9092"
else
  echo -e "  ⚪ \033[1mPrometheus:\033[0m   Not running"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q plantcor-langfuse; then
  echo -e "  ✅ \033[1mLangfuse:\033[0m     http://localhost:3002"
else
  echo -e "  ⚪ \033[1mLangfuse:\033[0m     Not running"
fi

echo ""
echo -e "\033[0;35m────────────────────────────────────────────────────────────────\033[0m"
echo ""
echo -e "\033[1m🔧 Quick Commands:\033[0m"
echo "  Stop:      ./ops/deploy.sh local --clean"
echo "  Logs:      tail -f deploy-*.log portal.log"
echo "  Monitor:   docker ps | grep plantcor"
echo ""
echo -e "\033[0;35m────────────────────────────────────────────────────────────────\033[0m"
echo ""
echo -e "\033[1m📁 Log Files:\033[0m"
ls -t deploy-*.log 2>/dev/null | head -1 | xargs -I {} echo "  {}"
echo "  portal.log"
echo ""
echo -e "\033[0;32m\033[1mPress Enter to close this window...\033[0m"
read
date
RESULTSEOF
  chmod +x "$results_script"
  
  # Launch results terminal
  log "Opening deployment results terminal..."
  case "$TERMINAL_TYPE" in
    kitty)
      kitty --title "Arch-Systems Deployment Results" bash "$results_script" &
      ;;
    gnome)
      gnome-terminal --title="Arch-Systems Deployment Results" -- bash "$results_script" &
      ;;
    konsole)
      konsole --title "Arch-Systems Deployment Results" -e "bash $results_script" &
      ;;
    alacritty)
      alacritty -t "Arch-Systems Deployment Results" -e bash "$results_script" &
      ;;
    xfce4)
      xfce4-terminal --title="Arch-Systems Deployment Results" -e "bash $results_script" &
      ;;
    xterm)
      xterm -title "Arch-Systems Deployment Results" -e "bash $results_script" &
      ;;
  esac
  success "Results terminal launched"
  
  # Also open browser if not disabled
  [ "$NO_BROWSER" = true ] && return 0
  
  sleep 2
  
  # Double-check portal is responding
  if ! curl -fs "http://localhost:$PORT" > /dev/null 2>&1; then
    warn "Portal not responding, skipping browser open"
    return 0
  fi
  
  log "Opening browser to: $login_url"
  
  if command -v google-chrome > /dev/null 2>&1; then
    google-chrome --new-window "$login_url" 2>/dev/null &
    success "Chrome opened"
  elif command -v chromium > /dev/null 2>&1; then
    chromium --new-window "$login_url" 2>/dev/null &
    success "Chromium opened"
  elif command -v firefox > /dev/null 2>&1; then
    firefox --new-window "$login_url" 2>/dev/null &
    success "Firefox opened"
  elif command -v xdg-open > /dev/null 2>&1; then
    xdg-open "$login_url" 2>/dev/null &
    success "Browser opened via xdg-open"
  elif command -v open > /dev/null 2>&1; then
    open "$login_url"
    success "Browser opened (macOS)"
  else
    warn "No browser launcher found"
    log "Please manually open: $login_url"
  fi
}

# ── Main ────────────────────────────────────────────────
main() {
  echo
  echo -e "${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║     ARCH-SYSTEMS SEQUENTIAL DEPLOYMENT v2.2                    ║${NC}"
  echo -e "${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo
  
  # Mode validation
  case "$DEPLOY_MODE" in
    local|staging|production) ;;
    *)
      echo "Usage: $0 [local|staging|production] [options]"
      echo
      echo "Options:"
      echo "  --skip-build     Skip build"
      echo "  --skip-tests     Skip tests"
      echo "  --clean          Clean restart"
      echo "  --dry-run        Preview only"
      echo "  --migrate-only   Only migrations"
      echo "  --rollback       Rollback"
      echo "  --force          Skip confirmation"
      echo "  --lightweight    Skip n8n, Flowise, Redis tools, and monitoring (portal + Supabase only)"
      echo "  --no-browser     Don't open browser"
      echo
      exit 1
      ;;
  esac
  
  # Special modes
  if [ "$ROLLBACK" = true ]; then
    echo "Rollback not yet implemented - use manual restore"
    exit 1
  fi
  
  if [ "$CLEAN_ONLY" = true ]; then
    acquire_lock
    phase_stop_services
    cleanup_lock
    echo
    success "Cleanup complete"
    exit 0
  fi
  
  if [ "$MIGRATE_ONLY" = true ]; then
    acquire_lock
    phase_validate
    phase_migrations
    cleanup_lock
    exit 0
  fi
  
  # Dry run notice
  if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}[DRY-RUN MODE] No changes will be made${NC}"
    echo
  fi
  
  # Initialize
  acquire_lock
  touch "$DEPLOY_LOG"
  
  log "Mode: $DEPLOY_MODE"
  log "Log: $DEPLOY_LOG"
  log "Terminal: $TERMINAL_TYPE"
  echo
  
  # Pre-flight: validate ALL prerequisites before touching anything
  validate_prerequisites

  # Confirm
  confirm

  # Execute phases sequentially
  phase_port_check
  phase_validate
  phase_backup
  phase_stop_services
  phase_build
  phase_start_infrastructure
  phase_migrations
  phase_deploy_portal
  phase_testing
  phase_launch_monitoring
  phase_results_and_browser
  
  # Cleanup
  cleanup_lock
  
  # Summary
  echo
  echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║     🎉 DEPLOYMENT COMPLETE - ALL SYSTEMS OPERATIONAL          ║${NC}"
  echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo
  log "Portal:    http://localhost:$PORT"
  log "Login:     http://localhost:$PORT/login"
  [ "$DEPLOY_MODE" = "local" ] && log "Supabase:  http://localhost:54321"
  [ "$DEPLOY_MODE" = "local" ] && log "n8n:       http://localhost:5678"
  [ "$DEPLOY_MODE" = "local" ] && log "Grafana:   http://localhost:9091"
  echo
  log "Logs: tail -f $DEPLOY_LOG"
  log "Stop: $0 $DEPLOY_MODE --clean"
  echo
}

# Run
main "$@"
