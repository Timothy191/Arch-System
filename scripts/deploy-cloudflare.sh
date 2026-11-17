#!/usr/bin/env bash
# ==============================================================================
# Arch-System — Cloudflare Tunnel Deployment Orchestrator (SAFE)
# ==============================================================================
# Safe replacement for the previous deploy-cloudflare.sh which performed unsafe
# SIGKILL-on-port termination and hard Docker/Supabase stack assumptions.
#
# This script:
#   - NEVER kills arbitrary processes by port number without explicit
#     operator confirmation.
#   - NEVER forces kill -9 unless the operator explicitly opts in.
#   - Does NOT assume a local Supabase/Docker stack is required.
#   - Supports separate dev (TryCloudflare) and production (named tunnel)
#     templates; production tunnel is NEVER started automatically.
#   - Provides subcommands: validate-config, dev-start, dev-stop, status,
#     health-check, shutdown, tunnel-config-example.
#
# All Cloudflare credentials (tunnel ID, credentials file path, domain hostnames)
# are supplied via environment variables, never committed inline.
#
# Environment variables (all optional, documented defaults):
#   CLOUDFLARE_TUNNEL_ID        Named tunnel ID for production mode
#   CLOUDFLARE_TUNNEL_CREDS     Path to tunnel credentials JSON file
#   CLOUDFLARE_DEV_DOMAIN       Hostname for dev tunnel (optional)
#   CLOUDFLARE_PROD_DOMAIN      Hostname for production tunnel (optional)
#   CLOUDFLARE_PORT             Local origin port (default: 3000)
#   CLOUDFLARE_RUN_DIR          PID/log directory (default: ./run)
#   CLOUDFLARE_MODE             dev | prod (default: dev)
#   CLOUDFLARE_ALLOW_PORT_KILL  Set to "1" to allow port termination (default: 0)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

LOG_LABEL="[cloudflare]"

REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
PORTAL_DIR="${PORTAL_DIR:-$REPO_ROOT/apps/portal}"
RUN_DIR="${CLOUDFLARE_RUN_DIR:-$REPO_ROOT/run}"
PORT="${CLOUDFLARE_PORT:-3000}"
MODE="${CLOUDFLARE_MODE:-dev}"
TUNNEL_ID="${CLOUDFLARE_TUNNEL_ID:-}"
TUNNEL_CREDS="${CLOUDFLARE_TUNNEL_CREDS:-}"
DEV_DOMAIN="${CLOUDFLARE_DEV_DOMAIN:-}"
PROD_DOMAIN="${CLOUDFLARE_PROD_DOMAIN:-}"
ALLOW_PORT_KILL="${CLOUDFLARE_ALLOW_PORT_KILL:-0}"

mkdir -p "$RUN_DIR"

# ── Subcommand usage ──────────────────────────────────────────────────────────

usage() {
  cat <<EOF
Usage: $0 <subcommand> [options]

Subcommands:
  validate-config   Validate the tunnel config YAML without starting anything
  dev-start         Start local portal + TryCloudflare dev tunnel
  dev-stop          Stop locally started portal/dev-tunnel processes
  status            Show status of PID files and cloudflared binary
  health-check      Poll the local origin health endpoint
  shutdown          Stop all processes tracked by this script
  tunnel-config-example   Print a sanitised tunnel config example (no secrets)

Environment variables (all optional):
  CLOUDFLARE_TUNNEL_ID        Named tunnel ID for production mode
  CLOUDFLARE_TUNNEL_CREDS     Path to tunnel credentials JSON file
  CLOUDFLARE_DEV_DOMAIN       Hostname for dev tunnel (optional)
  CLOUDFLARE_PROD_DOMAIN      Hostname for production tunnel (optional)
  CLOUDFLARE_PORT             Local origin port (default: 3000)
  CLOUDFLARE_RUN_DIR          PID/log directory (default: ./run)
  CLOUDFLARE_MODE             dev | prod (default: dev)
  CLOUDFLARE_ALLOW_PORT_KILL  Set to "1" to allow port termination (default: 0)

Examples:
  CLOUDFLARE_MODE=dev CLOUDFLARE_PORT=3000 $0 dev-start
  CLOUDFLARE_MODE=prod CLOUDFLARE_TUNNEL_ID=... CLOUDFLARE_TUNNEL_CREDS=... \
    CLOUDFLARE_ALLOW_PORT_KILL=1 $0 validate-config
EOF
  exit 0
}

# ── Safety guards ─────────────────────────────────────────────────────────────

# Safe port check using ss (preferred) or lsof fallback, with no automatic kill.
is_port_in_use_safe() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :${port}" | grep -q 'LISTEN'
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$port" >/dev/null 2>&1
  else
    warn "Neither ss nor lsof available; cannot detect port usage"
    return 1
  fi
}

# Report PIDs on a port without killing them.
list_port_pids() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :${port}" 2>/dev/null | awk 'NR>1{print $NF}' | tr -d '"'
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$port" 2>/dev/null | head -n1 || true
  fi
}

confirm_port_kill() {
  local port="$1"
  local pids
  pids=$(list_port_pids "$port" || true)
  if [ -z "$pids" ]; then
    info "Port $PORT is not in use."
    return 0
  fi

  warn "Port $PORT is in use by PID(s): $pids"
  info "Refusing to terminate automatically (safe default)."

  if [ "$ALLOW_PORT_KILL" != "1" ]; then
    fatal "Port $PORT is occupied. Set CLOUDFLARE_ALLOW_PORT_KILL=1 to confirm \
termination, or stop the process manually."
  fi

  warn "CLOUDFLARE_ALLOW_PORT_KILL=1 set — operator confirmed port termination."
  return 0
}

kill_pid_graceful() {
  local pidfile="$1" name="${2:-service}"
  if [ -f "$pidfile" ]; then
    local pid
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      info "Stopping $name (PID: $pid)..."
      kill -TERM "$pid" 2>/dev/null || true
      local i
      for ((i = 0; i < 10; i++)); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 1
      done
      if kill -0 "$pid" 2>/dev/null; then
        warn "$name did not stop gracefully after 10s; leaving running."
        warn "Manual intervention required: kill $pid"
      else
        log "$name stopped cleanly."
      fi
    fi
    rm -f "$pidfile"
  fi
}

# ── cloudflared binary check ──────────────────────────────────────────────────

require_cloudflared() {
  if ! command -v cloudflared >/dev/null 2>&1; then
    fatal "cloudflared is not installed. Install via your package manager."
  fi
  info "Cloudflared: $(cloudflared --version 2>&1 | head -n 1)"
}

# ── Tunnel config generation (sanitised, env-var driven) ──────────────────────

generate_tunnel_config() {
  local output_path="${1:-/dev/stdout}"

  cat > "$output_path" <<YAML
# Auto-generated by scripts/deploy-cloudflare.sh — DO NOT COMMIT SECRETS
# Populate CLOUDFLARE_TUNNEL_ID and CLOUDFLARE_TUNNEL_CREDS before production use.
tunnel: ${TUNNEL_ID:-REPLACE_ME_TUNNEL_ID}
credentials-file: ${TUNNEL_CREDS:-/etc/cloudflared/creds/REPLACE_ME.json}

originRequest:
  connectTimeout: 30s
  keepAliveTimeout: 90s
  noTLSVerify: false

ingress:
  # Primary Next.js Portal origin (localhost only — never bind to 0.0.0.0)
  - hostname: ${PROD_DOMAIN:-REPLACE_ME_DOMAIN}
    service: http://127.0.0.1:${PORT}
    originRequest:
      keepAliveConnections: 10

  # Default-deny fallback (required by cloudflared)
  - service: http_status:404
YAML

  info "Tunnel config written to ${output_path}"
}

# ── Subcommand implementations ───────────────────────────────────────────────

cmd_validate_config() {
  phase "Validate Tunnel Configuration"
  require_cloudflared

  local tmp_config
  tmp_config=$(mktemp)
  generate_tunnel_config "$tmp_config"

  info "Validating generated tunnel config (ingress rules only, no tunnel start)..."
  if cloudflared tunnel --config "$tmp_config" ingress validate >/dev/null 2>&1; then
    success "Tunnel config validation passed."
  else
    error "Tunnel config validation failed."
    cloudflared tunnel --config "$tmp_config" ingress validate || true
    rm -f "$tmp_config"
    exit 1
  fi

  if [ -z "$TUNNEL_ID" ]; then
    warn "CLOUDFLARE_TUNNEL_ID is not set — production tunnel cannot be started."
  fi
  if [ -z "$TUNNEL_CREDS" ]; then
    warn "CLOUDFLARE_TUNNEL_CREDS is not set — credentials file path missing."
  fi

  rm -f "$tmp_config"
}

cmd_dev_start() {
  phase "Development Mode — TryCloudflare Tunnel"
  require_cloudflared

  # Confirm portal port safety before starting anything.
  if is_port_in_use_safe "$PORT"; then
    confirm_port_kill "$PORT"
  fi

  mkdir -p "$RUN_DIR"

  info "Starting local Next.js portal on port $PORT..."
  cd "$PORTAL_DIR"
  PORT=$PORT pnpm dev > "$RUN_DIR/cloudflare-portal.log" 2>&1 &
  local portal_pid=$!
  echo "$portal_pid" > "$RUN_DIR/cloudflare-portal.pid"
  cd "$REPO_ROOT"
  info "Portal started (PID: $portal_pid)"

  info "Waiting for portal health endpoint..."
  local healthy=false
  for i in $(seq 1 30); do
    if curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
      healthy=true
      break
    fi
    sleep 2
  done

  if [ "$healthy" = false ]; then
    warn "Portal /api/health did not return 200 within 60s."
    warn "Check logs: tail -n 50 $RUN_DIR/cloudflare-portal.log"
  else
    success "Portal health check verified (200 OK)."
  fi

  info "Starting TryCloudflare dev tunnel for http://127.0.0.1:$PORT..."
  cloudflared tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate > "$RUN_DIR/cloudflare-tunnel.log" 2>&1 &
  local tunnel_pid=$!
  echo "$tunnel_pid" > "$RUN_DIR/cloudflare-tunnel.pid"

  local cf_url=""
  for i in $(seq 1 15); do
    cf_url=$(grep -o 'https://[-0-9a-z]*\.trycloudflare\.com' "$RUN_DIR/cloudflare-tunnel.log" 2>/dev/null | head -n 1 || true)
    if [ -n "$cf_url" ]; then
      break
    fi
    sleep 1
  done

  if [ -n "$cf_url" ]; then
    success "TryCloudflare dev tunnel active: $cf_url"
  else
    warn "Dev tunnel URL not detected yet. Check: $RUN_DIR/cloudflare-tunnel.log"
  fi

  echo
  echo "Local portal:  http://127.0.0.1:$PORT"
  echo "Tunnel log:    $RUN_DIR/cloudflare-tunnel.log"
  echo "Portal log:    $RUN_DIR/cloudflare-portal.log"
  echo "To stop:       $0 dev-stop"
}

cmd_dev_stop() {
  phase "Stop Development Processes"
  kill_pid_graceful "$RUN_DIR/cloudflare-portal.pid" "portal"
  kill_pid_graceful "$RUN_DIR/cloudflare-tunnel.pid" "cloudflared dev tunnel"
  success "Development processes stopped."
}

cmd_status() {
  phase "Cloudflare Tunnel Status"
  require_cloudflared

  echo "Script directory:   $SCRIPT_DIR"
  echo "Repo root:          $REPO_ROOT"
  echo "Run directory:      $RUN_DIR"
  echo "Portal port:        $PORT"
  echo "Mode:               $MODE"
  echo "Tunnel ID:          ${TUNNEL_ID:-<not set>}"
  echo "Tunnel creds:       ${TUNNEL_CREDS:-<not set>}"
  echo "Allow port kill:    $ALLOW_PORT_KILL"
  echo

  if [ -f "$RUN_DIR/cloudflare-portal.pid" ]; then
    local pid
    pid=$(cat "$RUN_DIR/cloudflare-portal.pid" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "Portal:             RUNNING (PID: $pid)"
    else
      echo "Portal:             NOT RUNNING (stale PID file)"
    fi
  else
    echo "Portal:             NOT RUNNING"
  fi

  if [ -f "$RUN_DIR/cloudflare-tunnel.pid" ]; then
    local pid
    pid=$(cat "$RUN_DIR/cloudflare-tunnel.pid" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "Cloudflared tunnel: RUNNING (PID: $pid)"
    else
      echo "Cloudflared tunnel: NOT RUNNING (stale PID file)"
    fi
  else
    echo "Cloudflared tunnel: NOT RUNNING"
  fi

  echo
  if is_port_in_use_safe "$PORT"; then
    echo "Port $PORT:         IN USE (PIDs: $(list_port_pids "$PORT" | tr '\n' ' '))"
  else
    echo "Port $PORT:         FREE"
  fi
}

cmd_health_check() {
  phase "Health Check — Local Origin"
  require_cloudflared

  local url="http://127.0.0.1:$PORT/api/health"
  info "Polling $url ..."

  if curl -fs "$url" >/dev/null 2>&1; then
    success "Local origin is healthy (200 OK)."
  else
    fatal "Local origin at $url is not responding."
  fi
}

cmd_shutdown() {
  phase "Shutdown All Tracked Cloudflare Processes"
  kill_pid_graceful "$RUN_DIR/cloudflare-portal.pid" "portal"
  kill_pid_graceful "$RUN_DIR/cloudflare-tunnel.pid" "cloudflared dev tunnel"
  success "Shutdown complete."
}

cmd_tunnel_config_example() {
  phase "Sanitised Tunnel Config Example"
  cat <<'EOF'
# Production Cloudflare Tunnel Configuration (sanitised example)
# Copy to infra/cloudflared/production-tunnel.yml and replace values.
#
# Never commit real tunnel IDs, credentials, or domain hostnames.
# Populate via environment variables:
#   CLOUDFLARE_TUNNEL_ID
#   CLOUDFLARE_TUNNEL_CREDS
#   CLOUDFLARE_PROD_DOMAIN

tunnel: REPLACE_WITH_TUNNEL_ID
credentials-file: REPLACE_WITH_CREDENTIALS_FILE_PATH

originRequest:
  connectTimeout: 30s
  keepAliveTimeout: 90s
  noTLSVerify: false

ingress:
  - hostname: REPLACE_WITH_PROD_DOMAIN
    service: http://127.0.0.1:3000
    originRequest:
      keepAliveConnections: 10

  # Default-deny fallback (required by cloudflared)
  - service: http_status:404
EOF
}

# ── Entry point ───────────────────────────────────────────────────────────────

if [ $# -eq 0 ]; then
  usage
fi

SUBCOMMAND="$1"
shift || true

case "$SUBCOMMAND" in
  validate-config) cmd_validate_config ;;
  dev-start)       cmd_dev_start ;;
  dev-stop)        cmd_dev_stop ;;
  status)          cmd_status ;;
  health-check)    cmd_health_check ;;
  shutdown)        cmd_shutdown ;;
  tunnel-config-example) cmd_tunnel_config_example ;;
  --help|-h|help)  usage ;;
  *) fatal "Unknown subcommand: $SUBCOMMAND. Run '$0 --help' for usage." ;;
esac
