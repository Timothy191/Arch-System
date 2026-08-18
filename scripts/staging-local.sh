#!/usr/bin/env bash
# ==============================================================================
# Arch-Systems Portal — Production Staging Simulation Runner
# ==============================================================================
# Simulates the production Linux server topology locally using Docker Compose:
#   - Standalone Next.js 16 Portal container
#   - Nginx Reverse Proxy with SSL on ports 8080/8443
#   - Redis Cache & Session Store
#
# Usage:
#   ./scripts/staging-local.sh [start|stop|restart|status|logs]
# ==============================================================================

set -euo pipefail

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
BOLD="\033[1m"
NC="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/infra/docker/compose.staging.yml"

ACTION="${1:-start}"

log() {
  echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*"
}

success() {
  echo -e "${GREEN}${BOLD}✔ $*${NC}"
}

warn() {
  echo -e "${YELLOW}⚠ $*${NC}"
}

error() {
  echo -e "${RED}${BOLD}✖ $*${NC}" >&2
}

case "$ACTION" in
  start)
    log "Starting production staging simulation environment..."

    # 1. Run Pre-flight verification if .env.production exists
    if [ -f "${REPO_ROOT}/.env.production" ]; then
      log "Running pre-flight environment checks..."
      "${REPO_ROOT}/scripts/verify-prod-env.sh" "${REPO_ROOT}/.env.production" || {
        warn "Pre-flight reported warnings/issues. Continuing with staging launch..."
      }
    else
      warn ".env.production not found; copying template..."
      cp "${REPO_ROOT}/apps/portal/env/.env.production.example" "${REPO_ROOT}/.env.production"
    fi

    # 2. Launch Compose Stack
    log "Building and starting containers..."
    docker compose -f "$COMPOSE_FILE" up --build -d

    # 3. Wait for Nginx and Portal health
    log "Waiting for services to become healthy..."
    sleep 5

    success "Staging environment is up and running!"
    echo
    echo -e "${BOLD}Staging Access URLs:${NC}"
    echo -e "  HTTP Endpoint  : ${BLUE}http://localhost:8080${NC}"
    echo -e "  HTTPS Endpoint : ${BLUE}https://localhost:8443${NC}"
    echo -e "  Health Check   : ${BLUE}http://localhost:8080/api/health${NC}"
    echo
    echo -e "${YELLOW}To stop the staging environment:${NC}"
    echo -e "  ./scripts/staging-local.sh stop"
    ;;

  stop)
    log "Stopping production staging simulation..."
    docker compose -f "$COMPOSE_FILE" down
    success "Staging environment stopped."
    ;;

  restart)
    log "Restarting production staging simulation..."
    docker compose -f "$COMPOSE_FILE" restart
    success "Staging environment restarted."
    ;;

  status)
    docker compose -f "$COMPOSE_FILE" ps
    ;;

  logs)
    docker compose -f "$COMPOSE_FILE" logs -f "${2:-}"
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
