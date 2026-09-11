#!/usr/bin/env bash
# shellcheck disable=SC1090,SC2034
# ==============================================================================
# Arch-Systems — Shared Shell Utilities Library
# ==============================================================================
# Provides common utilities used across all deployment, setup, and dev scripts:
#   - Unified color palette
#   - Logging functions (log, info, warn, error, fatal, success, phase)
#   - Error collection and reporting
#   - OS detection and distro helpers
#   - Docker Compose detection
#   - Safe .env file parsing (no eval)
#   - Terminal detection and launching helpers
#   - Port management utilities
#   - Process/PID file management
#   - HTTP health-check / wait-for-url
#   - Browser opening
#   - Dry-run execution wrapper
#
# Usage (from any script):
#   source "$(dirname "$0")/lib/common.sh"
#   or
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
# ==============================================================================

# ── Guard: prevent double-sourcing ─────────────────────────────────────────────
if [ -n "${COMMON_SH_SOURCED:-}" ]; then return 0; fi
COMMON_SH_SOURCED=1

# ── Color Palette ──────────────────────────────────────────────────────────────
# Unified color constants used by all scripts. The short-form aliases (RED,
# GREEN, etc.) are provided for backward compatibility with scripts that
# were originally written to use them directly.
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
CLR_GRAY="\033[0;90m"
CLR_BG_RED="\033[41;37;1m"
CLR_BG_GREEN="\033[42;37;1m"
CLR_BG_MAGENTA="\033[45;37;1m"

# Backward-compatible short aliases
RED="$CLR_RED"
GREEN="$CLR_GREEN"
YELLOW="$CLR_YELLOW"
BLUE="$CLR_BLUE"
CYAN="$CLR_CYAN"
MAGENTA="$CLR_MAGENTA"
WHITE="$CLR_WHITE"
NC="$CLR_RESET"
BOLD="$CLR_BOLD"

# ── Log File Support ───────────────────────────────────────────────────────────
# If LOG_FILE is set, log/info/warn/error/success output is appended there.
LOG_FILE="${LOG_FILE:-}"

# ── Logging Functions ──────────────────────────────────────────────────────────
# All logging functions append to $LOG_FILE if set. The prefix label is
# configurable via the global $LOG_LABEL variable (defaults to "SCRIPT").

# _write_log: internal helper — echoes a timestamped message to both stdout
#   and the log file (if LOG_FILE is set).
_write_log() {
  local level="$1" prefix="$2" color="$3"; shift 3
  local msg="[$(date '+%H:%M:%S')] $*"
  echo -e "${color}${prefix}${NC} ${msg}"
  if [ -n "$LOG_FILE" ]; then
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
  fi
}

log()    { _write_log "log"   "${LOG_LABEL:-[SCRIPT]}" "$GREEN"  "$*"; }
info()   { _write_log "info"  "[INFO]"                  "$BLUE"   "$*"; }
warn()   { _write_log "warn"  "[WARN]"                  "$YELLOW" "$*"; }
error()  { _write_log "error" "[ERROR]"                 "$RED"    "$*" >&2; }
fatal()  { error "$*"; exit 1; }

# success: prints a bold green checkmark message
success() {
  local msg="[$(date '+%H:%M:%S')] ✅ $*"
  echo -e "${GREEN}${BOLD}✅ $*${NC}"
  if [ -n "$LOG_FILE" ]; then
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
  fi
}

# phase: prints a prominent section header
phase() {
  local msg="[$(date '+%H:%M:%S')] PHASE: $*"
  echo
  echo -e "${MAGENTA}${BOLD}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${MAGENTA}${BOLD}  $*${NC}"
  echo -e "${MAGENTA}${BOLD}══════════════════════════════════════════════════════════════${NC}"
  echo
  if [ -n "$LOG_FILE" ]; then
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
  fi
}

# ── Error Collection ───────────────────────────────────────────────────────────
# Scripts that need to collect multiple errors before failing use this pattern.
# The ERRORS array is the default collection; scripts can override by setting
# ERROR_COLLECTION_VAR before calling collect_error/report_errors_and_exit.

ERRORS=()
ERROR_COLLECTION_VAR="${ERROR_COLLECTION_VAR:-ERRORS}"

collect_error() {
  eval "${ERROR_COLLECTION_VAR}+=(\"\$*\")"
  error "$*"
}

report_errors_and_exit() {
  local count
  count=$(eval "echo \${#${ERROR_COLLECTION_VAR}[@]}" 2>/dev/null || echo 0)
  if [ "$count" -eq 0 ]; then return 0; fi

  echo
  echo -e "${RED}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}${BOLD}║                        SETUP FAILED                            ║${NC}"
  echo -e "${RED}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo
  echo -e "${RED}${BOLD}Found ${count} error(s):${NC}"
  echo
  local i=1
  local err
  while IFS= read -r err; do
    [ -z "$err" ] && continue
    echo -e "  ${RED}${BOLD}${i}.${NC} ${RED}${err}${NC}"
    i=$((i + 1))
  done < <(eval "echo \"\${${ERROR_COLLECTION_VAR}[@]}\"")
  echo
  echo -e "${YELLOW}Fix all errors above, then re-run.${NC}"
  echo
  exit 1
}

# ── Dry Run Helper ─────────────────────────────────────────────────────────────
# If DRY_RUN is true, prints what would be executed instead of running it.
run_if_not_dry() {
  if [ "${DRY_RUN:-false}" = "true" ]; then
    echo -e "${CYAN}[DRY-RUN]${NC} Would execute: $*"
  else
    "$@"
  fi
}

# ── OS Detection ───────────────────────────────────────────────────────────────
# Detects OS family and version, exporting:
#   OS       — distro ID (e.g. "ubuntu", "rocky", "rhel", "centos")
#   OS_VERSION — version ID string
#   OS_NAME  — pretty name
detect_os() {
  if [ -f /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    OS="${ID:-unknown}"
    OS_VERSION="${VERSION_ID:-unknown}"
    OS_NAME="${PRETTY_NAME:-Unknown OS}"
  else
    OS="unknown"
    OS_VERSION="unknown"
    OS_NAME="Unknown OS"
  fi
}
detect_os

# is_redhat_family: returns 0 (true) if the OS is Rocky, RHEL, or CentOS.
# Uses the OS variable set by detect_os.
is_redhat_family() {
  case "$OS" in
    rocky|rhel|centos) return 0 ;;
    *) return 1 ;;
  esac
}

# ── Repo Root & Key Directories ────────────────────────────────────────────────
# REPO_ROOT is the root of the Arch-System repository.
# ARCH_BASE_DIR and DATABASE_DIR are resolved based on whether the companion
# Arch-Base repo is present alongside this one.
REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
ARCH_BASE_DIR="${ARCH_BASE_DIR:-$(cd "$REPO_ROOT/../Arch-Base" 2>/dev/null && pwd || true)}"
if [ -n "$ARCH_BASE_DIR" ] && [ -d "$ARCH_BASE_DIR" ] && [ -f "$ARCH_BASE_DIR/supabase/config.toml" ]; then
  DATABASE_DIR="$ARCH_BASE_DIR"
  SUPABASE_DIR="$ARCH_BASE_DIR/supabase"
  ARCH_BASE_WEB_DIR="$ARCH_BASE_DIR/apps/web"
else
  ARCH_BASE_DIR=""
  DATABASE_DIR="$REPO_ROOT/packages/database"
  SUPABASE_DIR="$REPO_ROOT/packages/supabase"
  ARCH_BASE_WEB_DIR=""
fi

PORTAL_DIR="$REPO_ROOT/apps/portal"
RUN_DIR="$REPO_ROOT/run"
mkdir -p "$RUN_DIR"

# ── Docker Compose Detection ───────────────────────────────────────────────────
# Detects whether the docker compose plugin or the legacy docker-compose
# binary is available, and sets COMPOSE_CMD accordingly.
detect_compose_cmd() {
  if docker compose version > /dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose > /dev/null 2>&1; then
    echo "docker-compose"
  else
    echo "docker compose"  # Will fail later with a clear error
  fi
}
COMPOSE_CMD="${COMPOSE_CMD:-$(detect_compose_cmd)}"

# ── Safe .env File Parsing ─────────────────────────────────────────────────────
# get_env_var: extracts a single variable's value from an env file.
#   Does NOT use eval — safe for untrusted files.
#   Usage:  value=$(get_env_var "/path/.env" "NEXT_PUBLIC_SUPABASE_URL")
get_env_var() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '"\r'
}

# get_env_var_fallback: tries multiple key names for backward compatibility.
#   Usage:  value=$(get_env_var_fallback "$ENV_FILE" "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "SUPABASE_ANON_KEY")
get_env_var_fallback() {
  local file="$1"; shift
  local value
  for key in "$@"; do
    value=$(get_env_var "$file" "$key")
    if [ -n "$value" ]; then
      echo "$value"
      return 0
    fi
  done
  return 0
}

# ── Terminal Detection ─────────────────────────────────────────────────────────
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

# launch_in_terminal: opens a command in the detected terminal emulator.
#   Usage: launch_in_terminal "Window Title" "bash /path/to/script.sh"
launch_in_terminal() {
  local title="$1" script="$2"
  local term
  term=$(detect_terminal)

  case "$term" in
    kitty)    kitty --title "$title" bash "$script" & ;;
    gnome)    gnome-terminal --title="$title" -- bash "$script" & ;;
    konsole)  konsole --title "$title" -e "bash $script" & ;;
    alacritty) alacritty -t "$title" -e bash "$script" & ;;
    xfce4)    xfce4-terminal --title="$title" -e "bash $script" & ;;
    xterm)    xterm -title "$title" -e "bash $script" & ;;
    none)     warn "No compatible terminal emulator found for: $title" ;;
  esac
}

# ── Browser Opening ────────────────────────────────────────────────────────────
# open_browser: opens a URL in the first available browser.
#   Usage: open_browser "http://localhost:3000/login"
open_browser() {
  local url="$1"
  if command -v google-chrome > /dev/null 2>&1; then
    google-chrome --new-window "$url" 2>/dev/null &
  elif command -v chromium > /dev/null 2>&1; then
    chromium --new-window "$url" 2>/dev/null &
  elif command -v firefox > /dev/null 2>&1; then
    firefox --new-window "$url" 2>/dev/null &
  elif command -v xdg-open > /dev/null 2>&1; then
    xdg-open "$url" 2>/dev/null &
  elif command -v open > /dev/null 2>&1; then
    open "$url" 2>/dev/null &
  else
    warn "No browser launcher found. Please open manually: $url"
    return 1
  fi
}

# ── Port Management ────────────────────────────────────────────────────────────
# is_port_in_use: returns 0 if anything is listening on the given port.
is_port_in_use() {
  local port="$1"
  lsof -ti:"$port" > /dev/null 2>&1
}

# get_port_pid: prints the first PID occupying a port (empty if none).
get_port_pid() {
  local port="$1"
  lsof -ti:"$port" 2>/dev/null | head -n1
}

# is_port_held_by_docker: returns 0 if the port is held by a Docker process.
is_port_held_by_docker() {
  local port="$1"
  is_port_in_use "$port" || return 1
  local pid
  pid=$(get_port_pid "$port")
  [ -z "$pid" ] && return 1
  local proc
  proc=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
  [[ "$proc" == *"docker"* ]]
}

# kill_port: kills all processes listening on a port.
kill_port() {
  local port="$1" signal="${2:-9}"
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill "$signal" 2>/dev/null || true
    sleep 1
  fi
}

# ── HTTP Health Checking ───────────────────────────────────────────────────────
# wait_for_url: polls a URL until it returns 200 or times out.
#   Usage: wait_for_url "http://localhost:3000/login" "Portal" 60 2
wait_for_url() {
  local url="$1" label="${2:-service}" max="${3:-60}" delay="${4:-2}"
  local i
  for ((i = 1; i <= max; i++)); do
    if curl -fs "$url" > /dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

# healthcheck: like wait_for_url but with logging and failure message.
#   Usage: healthcheck "http://localhost:3000/api/health" 60 "Portal"
healthcheck() {
  local url="$1" max_attempts="${2:-60}" service_name="${3:-service}" delay="${4:-2}"

  if [ "${DRY_RUN:-false}" = "true" ]; then
    success "$service_name is healthy (dry-run)"
    return 0
  fi

  info "Health checking $service_name at $url (max ${max_attempts}s)..."

  local i
  for ((i = 1; i <= max_attempts; i++)); do
    if curl -fs "$url" > /dev/null 2>&1; then
      success "$service_name is healthy"
      return 0
    fi
    if (( i % 5 == 0 )); then
      echo -n "⏳ "
    fi
    sleep "$delay"
  done

  fatal "$service_name failed health check after ${max_attempts} attempts"
}

# http_status_code: prints the HTTP status code for a URL, or "000" on error.
http_status_code() {
  local url="$1"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$url" 2>/dev/null || true)
  [ -z "$code" ] && code="000"
  echo "$code"
}

# ── Process / PID File Management ──────────────────────────────────────────────
# pid_running: returns 0 if the given PID is a running process.
pid_running() {
  local pid="$1"
  [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1
}

# stop_pid_file: reads a PID from a file, sends SIGTERM, waits, then SIGKILLs.
#   Usage: stop_pid_file "/path/to/.pid" "Service Name"
stop_pid_file() {
  local pidfile="$1" name="${2:-service}"
  if [ -f "$pidfile" ]; then
    local pid
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [ -n "$pid" ] && pid_running "$pid"; then
      log "Stopping $name (PID: $pid)..."
      kill -TERM "$pid" 2>/dev/null || true
      local i
      for ((i = 0; i < 5; i++)); do
        pid_running "$pid" || break
        sleep 1
      done
      if pid_running "$pid"; then
        warn "$name did not stop gracefully. Force-killing..."
        kill -9 "$pid" 2>/dev/null || true
      else
        log "$name stopped cleanly."
      fi
    fi
    rm -f "$pidfile"
  fi
}

# start_background: starts a command in the background, saving its PID.
#   Usage: start_background "Description" "/path/to/pidfile" -- command args...
#   Example: start_background "Portal" "$RUN_DIR/.portal.pid" -- PORT=3000 pnpm start
start_background() {
  local desc="$1" pidfile="$2"; shift 2
  # Consume the "--" separator
  [ "$1" = "--" ] && shift

  log "Starting $desc in background..."
  if [ "${DRY_RUN:-false}" = "false" ]; then
    "$@" > "$RUN_DIR/${desc// /_}.log" 2>&1 &
    local pid=$!
    echo "$pid" > "$pidfile"
    info "$desc started (PID: $pid)"
  else
    echo -e "${CYAN}[DRY-RUN]${NC} Would start: $*"
  fi
}

# ── Supabase Helpers ───────────────────────────────────────────────────────────
# is_supabase_running: returns 0 if Supabase REST API is reachable.
#   In cloud mode, checks the configured SUPABASE_URL.
#   In local mode, checks http://127.0.0.1:54321/rest/v1/
is_supabase_running() {
  local supabase_url="${SUPABASE_URL:-}"
  local supabase_anon_key="${SUPABASE_ANON_KEY:-}"

  if [ -n "$supabase_url" ] && [[ "$supabase_url" == *supabase.* ]]; then
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
      "${supabase_url}/rest/v1/" -H "apikey: ${supabase_anon_key:-}" 2>/dev/null || true)
    [ -z "$code" ] && code="000"
    [[ "$code" =~ ^(200|401|403)$ ]]
  else
    curl -fs "http://127.0.0.1:54321/rest/v1/" > /dev/null 2>&1
  fi
}

# start_local_supabase: starts local Supabase containers (Arch-Base or fallback).
start_local_supabase() {
  if [ -n "$ARCH_BASE_DIR" ] && [ -d "$ARCH_BASE_DIR" ]; then
    log "Starting Arch-Base Supabase..."
    (cd "$ARCH_BASE_DIR" && npx supabase start) > /dev/null 2>&1 &
    local pid=$!
    spinner "$pid" "Booting Arch-Base Supabase containers"
  elif [ -d "$DATABASE_DIR" ]; then
    log "Starting local Supabase..."
    (cd "$DATABASE_DIR" && pnpx supabase start) > /dev/null 2>&1 &
    local pid=$!
    spinner "$pid" "Booting local Supabase containers"
  else
    warn "No local Supabase directory found. Use --hosted for Cloud Supabase."
  fi

  if wait_for_url "http://127.0.0.1:54321/rest/v1/" "Supabase API" 30; then
    success "Supabase API is active"
  else
    warn "Local Supabase not responding — use --hosted for Cloud Supabase"
  fi
}

# ── Spinner ────────────────────────────────────────────────────────────────────
# spinner: displays an animated spinner while a background PID is running.
#   Usage: some_long_command &  spinner $! "Doing thing"
spinner() {
  local pid="$1" msg="$2"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠦' '⠧' '⠇' '⠏')
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYAN}${frames[$i]}${NC} ${msg}... "
    i=$(( (i + 1) % ${#frames[@]} ))
    sleep 0.1
  done
  printf "\r  ${GREEN}✓${NC} ${msg}            \n"
}

# ── Summary Box ─────────────────────────────────────────────────────────────────
# print_success_box TITLE_COLOR TITLE_BORDER [MESSAGE...]
# Prints a bordered success/failure box.
#   Usage: print_success_box "$GREEN" "SUCCESS" "All checks passed"
print_result_box() {
  local color="$1" title="$2"; shift 2
  echo
  echo -e "${color}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${color}${BOLD}║                    ${title}                    ║${NC}"
  echo -e "${color}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo
  if [ "$#" -gt 0 ]; then
    echo -e "$*"
    echo
  fi
}

# ── Cleanup Registration ───────────────────────────────────────────────────────
# register_cleanup: registers a cleanup function to run on EXIT/INT/TERM.
# Avoids the "trap recursion" problem by temporarily disabling traps.
#   Usage: register_cleanup my_cleanup_func
register_cleanup() {
  local func="$1"
  trap "$func" EXIT INT TERM
}

# ── Version Helpers ────────────────────────────────────────────────────────────
# version_ge: returns 0 if $1 >= $2 (semantic version comparison).
#   Usage: if version_ge "v22.0.0" "22.0.0"; then ...
version_ge() {
  local actual="$1" required="$2"
  # Strip 'v' prefix if present
  actual="${actual#v}"
  required="${required#v}"
  [ "$(printf '%s\n' "$required" "$actual" | sort -V | head -n1)" = "$required" ]
}

# ── Env Var Presence Check ─────────────────────────────────────────────────────
# env_has_var: returns 0 if the given key exists with a non-empty value in the env file.
#   Usage: env_has_var "$ENV_FILE" "NEXT_PUBLIC_SUPABASE_URL"
env_has_var() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 1
  grep -qE "^${key}=" "$file" 2>/dev/null
}
