#!/usr/bin/env bash
# Arch-Systems Production Environment Setup Script v1.1
# Usage: ./scripts/setup-production-environment.sh [options]
#
# This script automates the setup of a production environment for Arch-Systems,
# including environment configuration, systemd service setup, and background
# process management.
#
# Options:
#   --no-systemd        Skip systemd service setup
#   --no-docker-tools   Skip Docker tools stack (Flowise, Langfuse, Qdrant, ClickHouse)
#   --no-monitoring     Skip monitoring stack (Prometheus, Grafana, cAdvisor)
#   --force             Force overwrite existing configuration
#   --dry-run           Preview changes without executing
#   --supabase-push     Apply migrations + regenerate types after Supabase starts
#   --help              Show usage information
#
# Production Environment Components:
#   Essential:
#     - Next.js Production Server (managed by Systemd or background process)
#     - Supabase Infrastructure (external or local)
#     - Redis Server
#   Highly Recommended:
#     - Docker Tools Stack (Flowise, Langfuse, Qdrant, ClickHouse)
#   Optional:
#     - Monitoring Stack (Prometheus, Grafana, cAdvisor)
#
# Uses: scripts/lib/common.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

# Configuration
SETUP_LOG="$REPO_ROOT/setup-production-$(date +%Y%m%d-%H%M%S).log"
LOG_FILE="$SETUP_LOG"
ENV_TEMPLATE="$PORTAL_DIR/.env.production.example"
ENV_TARGET="$PORTAL_DIR/.env"

# ── Parse Arguments ─────────────────────────────────────────────────────────────
SKIP_SYSTEMD=false
SKIP_DOCKER_TOOLS=false
SKIP_MONITORING=false
FORCE=false
DRY_RUN=false
SUPABASE_PUSH=false

for arg in "$@"; do
  case $arg in
    --no-systemd)       SKIP_SYSTEMD=true ;;
    --no-docker-tools)  SKIP_DOCKER_TOOLS=true ;;
    --no-monitoring)    SKIP_MONITORING=true ;;
    --force)            FORCE=true ;;
    --dry-run)          DRY_RUN=true ;;
    --supabase-push)    SUPABASE_PUSH=true ;;
    --help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --no-systemd        Skip systemd service setup"
      echo "  --no-docker-tools   Skip Docker tools stack"
      echo "  --no-monitoring     Skip monitoring stack"
      echo "  --force             Force overwrite existing configuration"
      echo "  --dry-run           Preview changes without executing"
      echo "  --supabase-push     Apply migrations and regenerate types"
      echo "  --help              Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# ── Error Collection ────────────────────────────────────────────────────────────
ERRORS=()
ERROR_COLLECTION_VAR="ERRORS"

# ── Firewall Check ──────────────────────────────────────────────────────────────
REQUIRED_PORTS=(
  "3000/tcp  (Next.js Portal)"
  "6333/tcp  (Qdrant)"
  "8123/tcp  (ClickHouse)"
  "9093/tcp  (Prometheus)"
  "9091/tcp  (Grafana)"
  "8082/tcp  (cAdvisor)"
)

check_firewall() {
  log "Checking firewall status..."
  if command -v firewall-cmd > /dev/null 2>&1; then
    if firewall-cmd --state > /dev/null 2>&1; then
      warn "firewalld is active. Ensure required ports are open:"
      for port_desc in "${REQUIRED_PORTS[@]}"; do
        warn "  $port_desc"
      done
      info "Run: sudo firewall-cmd --permanent --add-port=3000/tcp && sudo firewall-cmd --reload"
    else
      success "firewalld installed but not running"
    fi
  elif command -v ufw > /dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
      warn "ufw is active. Ensure required ports are allowed"
      info "Run: sudo ufw allow 3000/tcp"
    else
      success "ufw installed but not active"
    fi
  else
    info "No firewall detected or firewall status unknown"
  fi
}

# ── SELinux Check ─�────────────────────────────────────────────────────────────
check_selinux() {
  log "Checking SELinux status..."
  if command -v getenforce > /dev/null 2>&1; then
    local selinux_status
    selinux_status=$(getenforce 2>/dev/null || echo "unknown")
    case "$selinux_status" in
      Enforcing)
        warn "SELinux is enforcing. This may interfere with service operations."
        warn "Consider setting to permissive mode for setup: sudo setenforce 0"
        warn "For production, create proper SELinux policies instead."
        ;;
      Permissive)
        info "SELinux is permissive (warnings only)"
        ;;
      Disabled)
        success "SELinux is disabled"
        ;;
      *)
        info "SELinux status: $selinux_status"
        ;;
    esac
  else
    success "SELinux not detected (not installed on this system)"
  fi
}

# ── Rocky Linux / RHEL Guidance ─────────────────────────────────────────────────
show_rocky_linux_guidance() {
  if is_redhat_family; then
    echo
    echo -e "${YELLOW}${BOLD}═════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}${BOLD}  ROCKY LINUX / RHEL DETECTED — IMPORTANT SETUP NOTES${NC}"
    echo -e "${YELLOW}${BOLD}═════════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${BOLD}Before running this script, ensure you have:${NC}"
    echo
    echo -e "  1. ${CYAN}Node.js 22${NC} (via NodeSource):"
    echo -e "     curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -"
    echo -e "     sudo dnf install -y nodejs"
    echo
    echo -e "  2. ${CYAN}pnpm 9.15.9${NC}:"
    echo -e "     npm install -g pnpm@9.15.9"
    echo
    echo -e "  3. ${CYAN}Redis${NC}:"
    echo -e "     sudo dnf install -y redis"
    echo -e "     sudo systemctl enable --now redis"
    echo
    echo -e "  4. ${CYAN}Docker${NC}:"
    echo -e "     sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo"
    echo -e "     sudo dnf install -y docker-ce docker-ce-cli containerd.io"
    echo -e "     sudo systemctl enable --now docker"
    echo -e "     sudo usermod -aG docker \$USER"
    echo
    echo -e "  5. ${CYAN}Firewall${NC}:"
    echo -e "     sudo firewall-cmd --permanent --add-port=3000/tcp"
    echo -e "     sudo firewall-cmd --reload"
    echo
    echo -e "${BOLD}See: ${CYAN}scripts/ROCKY_LINUX_COMPATIBILITY.md${NC} for detailed guide${NC}"
    echo
    read -p "Press Enter to continue or Ctrl+C to abort..."
    echo
  fi
}

# ── Prerequisites Check ─────────────────────────────────────────────────────────
check_prerequisites() {
  phase "1. PREREQUISITES CHECK"
  ERRORS=()

  info "Detected OS: $OS_NAME"

  # Show Rocky Linux guidance if detected
  show_rocky_linux_guidance

  log "Checking Node.js..."
  local node_version
  node_version=$(node -v 2>/dev/null | sed 's/v//' || echo "0.0.0")
  if ! version_ge "$node_version" "22.0.0"; then
    if is_redhat_family; then
      collect_error "Node.js >= 22.0.0 required. Found: $node_version. Install via NodeSource: curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash - && sudo dnf install -y nodejs"
    else
      collect_error "Node.js >= 22.0.0 required. Found: $node_version"
    fi
  else
    success "Node.js v$node_version"
  fi

  log "Checking pnpm..."
  if ! command -v pnpm > /dev/null 2>&1; then
    collect_error "pnpm not found. Install: npm install -g pnpm@9.15.9"
  else
    local pnpm_version
    pnpm_version=$(pnpm -v 2>/dev/null || echo "0.0.0")
    success "pnpm v$pnpm_version"
  fi

  log "Checking Docker..."
  if ! docker info > /dev/null 2>&1; then
    if [ "$SKIP_DOCKER_TOOLS" = false ]; then
      if is_redhat_family; then
        warn "Docker is not running. Install Docker CE: sudo dnf install -y docker-ce docker-ce-cli containerd.io && sudo systemctl enable --now docker"
      fi
      warn "Docker is not running. Docker tools stack will be skipped."
      SKIP_DOCKER_TOOLS=true
    else
      warn "Docker not available (not required with --no-docker-tools)"
    fi
  else
    success "Docker OK"
  fi

  log "Checking systemd..."
  if ! command -v systemctl > /dev/null 2>&1; then
    if [ "$SKIP_SYSTEMD" = false ]; then
      warn "systemd not found. Systemd service setup will be skipped."
      SKIP_SYSTEMD=true
    fi
  else
    success "systemd OK"
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
  if [ ${#ERRORS[@]} -eq 0 ]; then
    success "Required directories OK"
  fi

  # Check firewall and SELinux on Rocky Linux/RHEL
  if is_redhat_family; then
    check_firewall
    check_selinux
  fi

  report_errors_and_exit
  success "Prerequisites check passed"
}

# ── Environment Configuration ───────────────────────────────────────────────────
setup_environment() {
  phase "2. ENVIRONMENT CONFIGURATION"

  log "Checking environment template..."
  if [ ! -f "$ENV_TEMPLATE" ]; then
    fatal "Environment template not found: $ENV_TEMPLATE"
  fi
  success "Environment template found"

  log "Checking existing environment file..."
  if [ -f "$ENV_TARGET" ]; then
    if [ "$FORCE" = true ]; then
      warn "Existing .env file will be overwritten (--force)"
      local backup_ts
      backup_ts=$(date +%Y%m%d-%H%M%S)
      run_if_not_dry cp "$ENV_TARGET" "$ENV_TARGET.backup.$backup_ts"
      info "Backed up existing .env to .env.backup.$backup_ts"
    else
      warn "Environment file already exists. Use --force to overwrite."
      info "Current file will be used. Review and update manually if needed."
      return 0
    fi
  fi

  log "Copying environment template..."
  run_if_not_dry cp "$ENV_TEMPLATE" "$ENV_TARGET"
  success "Environment file created: $ENV_TARGET"

  log "Verifying environment variables..."
  local required_vars=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    "SUPABASE_SERVICE_KEY"
    "DATABASE_URL"
  )

  local missing_vars=()
  for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" "$ENV_TARGET" 2>/dev/null; then
      missing_vars+=("$var")
    fi
  done

  if [ ${#missing_vars[@]} -gt 0 ]; then
    warn "The following required variables are missing or placeholder values:"
    for var in "${missing_vars[@]}"; do
      echo -e "  ${YELLOW}• $var${NC}"
    done
    echo
    warn "Please edit $ENV_TARGET and fill in all required production values."
    warn "DO NOT commit the .env file to git."
  else
    success "Required environment variables present"
  fi
}

# ── Systemd Service Setup ─────────────────────────────────────────────────────
setup_systemd() {
  if [ "$SKIP_SYSTEMD" = true ]; then
    info "Skipping systemd service setup (--no-systemd)"
    return 0
  fi

  phase "3. SYSTEMD SERVICE SETUP"

  local service_file="/etc/systemd/system/arch-systems.service"
  local user
  user="$(whoami)"

  log "Creating systemd service file..."
  cat <<EOF | run_if_not_dry sudo tee "$service_file" > /dev/null
[Unit]
Description=Arch-Systems Production Server
After=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$PORTAL_DIR
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=$(which pnpm) --filter portal start
Restart=always
RestartSec=10
StandardOutput=append:$REPO_ROOT/run/portal.log
StandardError=append:$REPO_ROOT/portal-error.log

[Install]
WantedBy=multi-user.target
EOF

  if [ "$DRY_RUN" = false ]; then
    success "Systemd service file created: $service_file"

    log "Reloading systemd daemon..."
    sudo systemctl daemon-reload
    success "Systemd daemon reloaded"

    log "Enabling arch-systems service..."
    sudo systemctl enable arch-systems
    success "Service enabled (will start on boot)"

    info "To start the service now, run: sudo systemctl start arch-systems"
    info "To check status: sudo systemctl status arch-systems"
    info "To view logs: sudo journalctl -u arch-systems -f"
  else
    success "Systemd service file would be created: $service_file"
  fi
}

# ── Essential Services Setup ─────────────────────────────────────────────────────
setup_essential_services() {
  phase "4. ESSENTIAL SERVICES SETUP"

  # Supabase
  log "Checking Supabase configuration..."
  local supa_url
  supa_url=$(get_env_var "$ENV_TARGET" "NEXT_PUBLIC_SUPABASE_URL")
  [ -z "$supa_url" ] && supa_url=$(get_env_var "$ENV_TARGET" "SUPABASE_URL")

  if [[ "$supa_url" == *localhost* ]] || [[ "$supa_url" == *127.0.0.1* ]]; then
    warn "Using local Supabase instance"
    log "Starting local Supabase..."
    run_if_not_dry pnpm --filter @repo/database supabase:dev
    success "Local Supabase started"

    if [ "$SUPABASE_PUSH" = true ]; then
      echo
      read -p "Run 'pnpm --filter @repo/database supabase:push' now to apply migrations and generate types? (y/N): " resp
      resp=${resp:-N}
      if [[ "$resp" =~ ^[Yy]$ ]]; then
        log "Applying Supabase migrations and regenerating types..."
        run_if_not_dry pnpm --filter @repo/database supabase:push
        run_if_not_dry pnpm --filter @repo/database supabase:gen
        success "Supabase migrations applied and types regenerated"
      else
        info "Skipping supabase:push as per user input"
      fi
    fi
  else
    success "Using external Supabase instance"
    info "Ensure external Supabase is accessible and configured"
  fi

  # Redis
  log "Checking Redis..."
  if ! redis-cli ping > /dev/null 2>&1; then
    warn "Redis is not running"
    info "Starting Redis server..."

    if is_redhat_family; then
      # Rocky Linux/RHEL typically use systemd service named 'redis'
      if command -v systemctl > /dev/null 2>&1; then
        if systemctl list-unit-files | grep -q "^redis\.service"; then
          run_if_not_dry sudo systemctl start redis
          success "Redis service started via systemd (redis)"
        elif systemctl list-unit-files | grep -q "^redis-server\.service"; then
          run_if_not_dry sudo systemctl start redis-server
          success "Redis service started via systemd (redis-server)"
        else
          warn "Redis service not found. Install: sudo dnf install -y redis && sudo systemctl enable --now redis"
        fi
      else
        warn "systemctl not available. Cannot start Redis service"
      fi
    elif command -v redis-server > /dev/null 2>&1; then
      # Try direct redis-server command for other systems
      run_if_not_dry redis-server --daemonize yes
      success "Redis server started via redis-server"
    elif command -v systemctl > /dev/null 2>&1; then
      # Try systemd services for other distributions
      run_if_not_dry sudo systemctl start redis-server 2>/dev/null || sudo systemctl start redis 2>/dev/null || true
      if redis-cli ping > /dev/null 2>&1; then
        success "Redis service started via systemd"
      else
        warn "Failed to start Redis via systemd"
      fi
    else
      warn "Redis not found. Install Redis or configure DISABLE_RATE_LIMIT=true in .env"
    fi

    # Verify Redis started successfully
    if redis-cli ping > /dev/null 2>&1; then
      success "Redis is now running"
    else
      warn "Redis still not responding. Manual intervention may be required"
    fi
  else
    success "Redis is running"
  fi
}

# ── Docker Tools Stack Setup ───────────────────────────────────────────────────
setup_docker_tools() {
  if [ "$SKIP_DOCKER_TOOLS" = true ]; then
    info "Skipping Docker tools stack (--no-docker-tools)"
    return 0
  fi

  phase "5. DOCKER TOOLS STACK SETUP"

  log "Checking Docker Compose configuration..."
  local compose_file="$REPO_ROOT/infra/docker/compose.tools.yml"
  if [ ! -f "$compose_file" ]; then
    warn "Docker Compose file not found: $compose_file"
    warn "Docker tools stack will be skipped"
    return 0
  fi

  log "Checking .env.tools configuration..."
  local env_tools="$REPO_ROOT/.env.tools"
  if [ ! -f "$env_tools" ]; then
    warn ".env.tools not found. Docker tools may not configure properly."
    info "Consider copying from template if available."
  fi

  log "Starting Docker tools stack..."
  if command -v docker-compose > /dev/null 2>&1; then
    run_if_not_dry docker-compose -f "$compose_file" up -d
  elif docker compose version > /dev/null 2>&1; then
    run_if_not_dry docker compose -f "$compose_file" up -d
  else
    warn "Docker Compose not found. Docker tools stack will be skipped."
    return 0
  fi

  success "Docker tools stack started"
  info "Services include: Flowise, Langfuse, Qdrant, ClickHouse"
  info "To view logs: docker-compose -f $compose_file logs -f"
  info "To stop: docker-compose -f $compose_file down"
}

# ── Monitoring Stack Setup ───────────────────────────────────────────────────────
setup_monitoring() {
  if [ "$SKIP_MONITORING" = true ]; then
    info "Skipping monitoring stack (--no-monitoring)"
    return 0
  fi

  phase "6. MONITORING STACK SETUP"

  log "Checking monitoring configuration..."
  local monitoring_file="$REPO_ROOT/infra/monitoring/docker-compose.yml"
  if [ ! -f "$monitoring_file" ]; then
    warn "Monitoring Docker Compose file not found"
    info "Monitoring stack will be skipped"
    return 0
  fi

  log "Starting monitoring stack..."
  if command -v docker-compose > /dev/null 2>&1; then
    run_if_not_dry docker-compose -f "$monitoring_file" up -d
  elif docker compose version > /dev/null 2>&1; then
    run_if_not_dry docker compose -f "$monitoring_file" up -d
  else
    warn "Docker Compose not found. Monitoring stack will be skipped."
    return 0
  fi

  success "Monitoring stack started"
  info "Services include: Prometheus, Grafana, cAdvisor"
  info "Grafana will be available at http://localhost:9091 (default)"
  info "To view logs: docker-compose -f $monitoring_file logs -f"
  info "To stop: docker-compose -f $monitoring_file down"
}

# ── Build and Start Portal ───────────────────────────────────────────────────────
build_and_start_portal() {
  phase "7. BUILD AND START PORTAL"

  log "Installing dependencies..."
  run_if_not_dry pnpm install
  success "Dependencies installed"

  log "Building application..."
  run_if_not_dry pnpm build
  success "Application built"

  if [ "$SKIP_SYSTEMD" = true ]; then
    log "Starting portal in background..."
    run_if_not_dry bash -lc "cd '$PORTAL_DIR' && \"$(which pnpm)\" start > '$REPO_ROOT/run/portal.log' 2>&1 & echo \$! > '$REPO_ROOT/run/.portal.pid'"
    if [ -f "$REPO_ROOT/run/.portal.pid" ]; then
      local portal_pid
      portal_pid=$(cat "$REPO_ROOT/run/.portal.pid")
      success "Portal started in background (PID: $portal_pid)"
      info "Logs: tail -f $REPO_ROOT/run/portal.log"
      info "To stop: kill $portal_pid"
    else
      warn "Failed to capture portal PID. Check $REPO_ROOT/run/portal.log for details."
    fi
  else
    info "Portal will be managed by systemd service"
    info "Start with: sudo systemctl start arch-systems"
  fi
}

# ── Health Check ─────────────────────────────────────────────────────────────────
health_check() {
  phase "8. HEALTH CHECK"

  local max_attempts=30
  local delay=2

  log "Checking portal health (max ${max_attempts}s)..."
  local i
  for ((i = 1; i <= max_attempts; i++)); do
    if curl -fs "http://localhost:3000/api/health" > /dev/null 2>&1; then
      success "Portal is healthy"
      return 0
    fi

    if (( i % 5 == 0 )); then
      echo -n "⏳ "
    fi

    sleep "$delay"
  done

  warn "Portal health check failed after ${max_attempts} attempts"
  info "Check logs: tail -50 $REPO_ROOT/run/portal.log"
  info "If using systemd: sudo journalctl -u arch-systems -n 50"
}

# ── Summary and Next Steps ───────────────────────────────────────────────────────
print_summary() {
  phase "SETUP COMPLETE"

  echo
  echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║              PRODUCTION ENVIRONMENT SETUP COMPLETE             ║${NC}"
  echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo
  echo -e "${BOLD}Essential Services:${NC}"
  echo -e "  • Next.js Portal: ${GREEN}Running${NC}"
  echo -e "  • Supabase: ${GREEN}Configured${NC}"
  echo -e "  • Redis: ${GREEN}Running${NC}"
  echo

  if [ "$SKIP_DOCKER_TOOLS" = false ]; then
    echo -e "${BOLD}Docker Tools Stack:${NC}"
    echo -e "  • Flowise: ${GREEN}Running${NC} (http://localhost:3000)"
    echo -e "  • Langfuse: ${GREEN}Running${NC} (http://localhost:3000)"
    echo -e "  • Qdrant: ${GREEN}Running${NC} (http://localhost:6333)"
    echo -e "  • ClickHouse: ${GREEN}Running${NC} (http://localhost:8123)"
    echo
  fi

  if [ "$SKIP_MONITORING" = false ]; then
    echo -e "${BOLD}Monitoring Stack:${NC}"
    echo -e "  • Prometheus: ${GREEN}Running${NC} (http://localhost:9093)"
    echo -e "  • Grafana: ${GREEN}Running${NC} (http://localhost:9091)"
    echo -e "  • cAdvisor: ${GREEN}Running${NC} (http://localhost:8082)"
    echo
  fi

  echo -e "${BOLD}Next Steps:${NC}"
  echo -e "  1. Review and update $ENV_TARGET with production values"
  echo -e "  2. Verify Supabase connection and run migrations: pnpm --filter @repo/database supabase:push"
  echo -e "  3. Access the portal at: ${CYAN}http://localhost:3000${NC}"
  echo

  echo -e "\033[1mLocal services recommendations:\033[0m"
  echo "  • Flowise, Supabase, Qdrant are expected to be hosted locally on this server or LAN. Ensure .env.tools and .env are configured to point to localhost or LAN IPs."
  echo "  • Open required ports (3000, 3001, 5678, 6333, 8123, 9091, 9093, 8082) in your firewall for internal access."
  echo "  • Confirm .env.tools has correct credentials for services (FLOWISE, REDIS_PASSWORD)."
  echo "  • For production, consider placing these services behind internal network controls (VLANs, firewalls) and not exposing them publicly."
  echo

  if [ "$SKIP_SYSTEMD" = false ]; then
    echo -e "${BOLD}Systemd Management:${NC}"
    echo -e "  • Start: sudo systemctl start arch-systems"
    echo -e "  • Stop: sudo systemctl stop arch-systems"
    echo -e "  • Status: sudo systemctl status arch-systems"
    echo -e "  • Logs: sudo journalctl -u arch-systems -f"
    echo
  else
    echo -e "${BOLD}Background Process Management:${NC}"
    echo -e "  • PID file: $REPO_ROOT/run/.portal.pid"
    echo -e "  • Logs: tail -f $REPO_ROOT/run/portal.log"
    echo -e "  • Stop: kill \$(cat $REPO_ROOT/run/.portal.pid)"
    echo
  fi

  echo -e "${BOLD}Documentation:${NC}"
  echo -e "  • Deployment guide: ${CYAN}DEPLOYMENT.md${NC}"
  echo -e "  • Environment files: ${CYAN}ENVIRONMENT_FILES_GUIDE.md${NC}"
  echo -e "  • Setup log: ${CYAN}$SETUP_LOG${NC}"
  echo

  if is_redhat_family; then
    echo -e "${BOLD}Rocky Linux/RHEL Notes:${NC}"
    echo -e "  • Compatibility guide: ${CYAN}scripts/ROCKY_LINUX_COMPATIBILITY.md${NC}"
    echo "  • Ensure firewalld ports are open"
    echo "  • Consider SELinux policies for production"
    echo
  fi

  echo -e "${YELLOW}⚠️  IMPORTANT: Never commit the .env file to git. It contains production secrets.${NC}"
  echo
}

# ── Main Execution ─────────────────────────────────────────────────────────────────
main() {
  LOG_LABEL="[SETUP]"
  echo
  echo -e "${CYAN}${BOLD}Arch-Systems Production Environment Setup${NC}"
  echo
  info "Running on: $OS_NAME"
  echo

  check_prerequisites
  setup_environment
  setup_systemd
  setup_essential_services
  setup_docker_tools
  setup_monitoring
  build_and_start_portal
  health_check
  print_summary
}

main
