#!/usr/bin/env bash
set -euo pipefail

# Arch-Systems — Preflight Checklist
# Usage: ./scripts/preflight-checklist.sh [--fix]
#
# Validates the local environment before deploying the portal.
# Safe to run anytime — all fixes are idempotent and require --fix to apply.
# Uses: scripts/lib/common.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

PORT="${PORT:-3000}"
FIX_MODE=false
WARNINGS=()
ERRORS=()

# ── Script-specific check display ───────────────────────────
# These use ✓/⚠/✗ icons unique to this script's output format,
# but share the unified color palette from common.sh.
check_pass() { echo -e "  ${GREEN}✓${NC} $*"; }
check_warn() { echo -e "  ${YELLOW}⚠${NC} $*"; WARNINGS+=("$*"); }
check_fail() { echo -e "  ${RED}✗${NC} $*"; ERRORS+=("$*"); }

header() {
  echo
  echo -e "${CYAN}${BOLD}$*${NC}"
  echo -e "${CYAN}$(printf '%*s' "${#1}" '' | tr ' ' '─')${NC}"
}

# ── Args ──────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in --fix) FIX_MODE=true ;; esac
done

echo -e "${BOLD}Arch-Systems Preflight Checklist${NC}"
echo "Repo: $REPO_ROOT"
[ "$FIX_MODE" = true ] && echo -e "${YELLOW}Fix mode enabled — will attempt repairs${NC}"

# ═══════════════════════════════════════════════════════════
# 1. ENVIRONMENT
# ═══════════════════════════════════════════════════════════
header "1. Environment"

if command -v node > /dev/null 2>&1; then
  NODE_VER=$(node -v | sed 's/v//')
  if version_ge "$NODE_VER" "20.17.0"; then
    check_pass "Node.js v$NODE_VER"
  else
    check_fail "Node.js >= 20.17.0 required (found $NODE_VER)"
  fi
else
  check_fail "Node.js not found"
fi

if command -v pnpm > /dev/null 2>&1; then
  PNPM_VER=$(pnpm -v)
  check_pass "pnpm v$PNPM_VER"
else
  check_fail "pnpm not found — install: npm install -g pnpm@9.12.0"
fi

ENV_FILE="$PORTAL_DIR/.env"
[ ! -f "$ENV_FILE" ] && [ -f "$REPO_ROOT/.env" ] && ENV_FILE="$REPO_ROOT/.env"
IS_CLOUD_SUPABASE=false
if [ -f "$ENV_FILE" ] && grep -qE '^NEXT_PUBLIC_SUPABASE_URL=https?://.*supabase\.(co|in)' "$ENV_FILE"; then
  IS_CLOUD_SUPABASE=true
fi

if docker info > /dev/null 2>&1; then
  check_pass "Docker daemon running"
elif [ "$IS_CLOUD_SUPABASE" = true ]; then
  check_pass "Docker daemon not running (optional — Cloud Supabase active)"
else
  check_warn "Docker daemon not running (required for local Supabase)"
fi

# ═══════════════════════════════════════════════════════════
# 2. REPOSITORY STRUCTURE
# ═══════════════════════════════════════════════════════════
header "2. Repository Structure"

[ -d "$REPO_ROOT/.git" ] && check_pass "Git repository" || check_fail "Not a git repository"
[ -d "$PORTAL_DIR" ]     && check_pass "apps/portal"   || check_fail "apps/portal missing"
if [ -n "$ARCH_BASE_DIR" ] && [ -d "$ARCH_BASE_DIR" ] && [ -f "$ARCH_BASE_DIR/supabase/config.toml" ]; then
  check_pass "Arch-Base database ($ARCH_BASE_DIR)"
  ([ -d "$DATABASE_DIR/supabase/migrations" ] || [ -d "$DATABASE_DIR/migrations" ]) && check_pass "Migrations directory (Arch-Base)" || check_fail "Migrations missing"
else
  [ -d "$DATABASE_DIR" ]   && check_pass "packages/database" || check_fail "packages/database missing"
  [ -d "$DATABASE_DIR/migrations" ] && check_pass "Migrations directory" || check_fail "Migrations missing"
fi
[ -f "$REPO_ROOT/pnpm-lock.yaml" ] && check_pass "pnpm-lock.yaml" || check_fail "pnpm-lock.yaml missing — run pnpm install"

# ═══════════════════════════════════════════════════════════
# 3. ENVIRONMENT FILES
# ═══════════════════════════════════════════════════════════
header "3. Environment Files"

if [ -f "$PORTAL_DIR/.env" ]; then
  check_pass "apps/portal/.env exists"
  SUPA_URL=$(get_env_var "$PORTAL_DIR/.env" "NEXT_PUBLIC_SUPABASE_URL")
  if [ -n "$SUPA_URL" ]; then
    check_pass "NEXT_PUBLIC_SUPABASE_URL set"
    if [[ "$SUPA_URL" == *localhost* ]] || [[ "$SUPA_URL" == *127.0.0.1* ]]; then
      check_warn "Supabase URL points to localhost — OK for local dev"
    fi
  else
    check_fail "NEXT_PUBLIC_SUPABASE_URL not set in .env"
  fi
else
  check_fail "apps/portal/.env missing"
  if [ "$FIX_MODE" = true ] && [ -f "$PORTAL_DIR/.env.example" ]; then
    cp "$PORTAL_DIR/.env.example" "$PORTAL_DIR/.env"
    echo -e "    ${YELLOW}→ Created .env from .env.example — verify secrets${NC}"
  fi
fi

if [ -f "$REPO_ROOT/.env.tools" ]; then
  check_pass ".env.tools exists"
else
  check_fail ".env.tools missing (required for Docker Tools)"
fi

# ═══════════════════════════════════════════════════════════
# 4. PORT CONFLICTS
# ═══════════════════════════════════════════════════════════
header "4. Port Conflicts"

check_port() {
  local port="$1" name="$2"
  if is_port_in_use "$port"; then
    local pid proc
    pid=$(get_port_pid "$port")
    proc=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
    if is_port_held_by_docker "$port"; then
      check_pass "$name port $port (Docker)"
      return 0
    fi
    check_warn "$name port $port occupied by native $proc (PID $pid)"
    if [ "$FIX_MODE" = true ]; then
      if kill -9 "$pid" 2>/dev/null; then
        echo -e "    ${GREEN}→ Killed PID $pid${NC}"
      else
        echo -e "    ${RED}→ Failed to kill PID $pid (may need sudo)${NC}"
      fi
    fi
  else
    check_pass "$name port $port free"
  fi
}

check_port "$PORT" "Portal"
check_port 54321 "Supabase API"
check_port 54322 "Supabase DB"
check_port 6379  "Redis"
check_port 6333  "Qdrant"
check_port 9091  "Grafana"
check_port 9092  "Prometheus"
check_port 1881  "Fuxa"

# ═══════════════════════════════════════════════════════════
# 5. STALE PROCESSES
# ═══════════════════════════════════════════════════════════
header "5. Stale Processes"

STALE_PIDS=$(pgrep -f "next-server" 2>/dev/null || true)
if [ -n "$STALE_PIDS" ]; then
  STALE_COUNT=$(echo "$STALE_PIDS" | wc -l)
  check_warn "Found $STALE_COUNT next-server process(es)"
  for pid in $STALE_PIDS; do
    proc_info=$(ps -p "$pid" -o pid,user,lstart,comm= 2>/dev/null || true)
    echo -e "    ${YELLOW}  $proc_info${NC}"
  done
  if [ "$FIX_MODE" = true ]; then
    echo "$STALE_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "    ${GREEN}→ Attempted cleanup${NC}"
  fi
else
  check_pass "No stale next-server processes"
fi

# ═══════════════════════════════════════════════════════════
# 6. DOCKER CONTAINERS
# ═══════════════════════════════════════════════════════════
header "6. Docker Containers"

if command -v docker > /dev/null 2>&1 && docker info > /dev/null 2>&1; then
  check_container() {
    local name="$1"
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || true)
    if [ -z "$status" ] || [ "$status" = "<no value>" ]; then
      status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
    fi
    [ -z "$status" ] && status="missing"
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      check_pass "$name container ($status)"
    elif [ "$status" = "missing" ]; then
      check_warn "$name container not running (starts during deployment)"
    else
      check_warn "$name container ($status)"
    fi
  }

  check_container "plantcor-redis"
  check_container "plantcor-qdrant"
  check_container "plantcor-prometheus"
  check_container "plantcor-fuxa"

  SUPABASE_UP=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -c "supabase" || echo "0")
  if [ "$SUPABASE_UP" -gt 0 ]; then
    check_pass "Supabase containers running ($SUPABASE_UP)"
  else
    check_warn "Supabase containers not running"
  fi
else
  check_warn "Docker unavailable — skipping container checks"
fi

# ═══════════════════════════════════════════════════════════
# 7. BUILD ARTIFACTS
# ═══════════════════════════════════════════════════════════
header "7. Build Artifacts"

if [ -d "$PORTAL_DIR/.next/standalone" ]; then
  check_pass ".next/standalone exists"
  if [ -f "$PORTAL_DIR/.next/standalone/apps/portal/server.js" ] || \
     [ -f "$PORTAL_DIR/.next/standalone/Arch-System/apps/portal/server.js" ] || \
     [ -f "$PORTAL_DIR/.next/standalone/server.js" ]; then
    check_pass "Standalone server.js present"
  else
    check_fail "Standalone server.js missing — rebuild with ENABLE_HEAVY_PLUGINS=true"
  fi
else
  check_fail ".next/standalone missing — run: ENABLE_HEAVY_PLUGINS=true pnpm build --filter=portal..."
fi

BUILD_AGE=""
if [ -d "$PORTAL_DIR/.next" ]; then
  BUILD_AGE=$(stat -c '%Y' "$PORTAL_DIR/.next" 2>/dev/null || stat -f '%m' "$PORTAL_DIR/.next" 2>/dev/null || echo "0")
  NOW=$(date +%s)
  AGE_HOURS=$(( (NOW - BUILD_AGE) / 3600 ))
  if [ "$AGE_HOURS" -gt 24 ]; then
    check_warn "Build is ${AGE_HOURS}h old — consider rebuilding"
  else
    check_pass "Build is ${AGE_HOURS}h old"
  fi
fi

# ═══════════════════════════════════════════════════════════
# 8. LOG FILES
# ═══════════════════════════════════════════════════════════
header "8. Log Cleanup"

LOG_FILES=(
  "$REPO_ROOT/run/portal.log"
  "$REPO_ROOT/portal-error.log"
  "$REPO_ROOT/deploy-*.log"
)

for pattern in "${LOG_FILES[@]}"; do
  for f in $pattern; do
    [ -f "$f" ] || continue
    size=$(du -h "$f" 2>/dev/null | cut -f1)
    lines=$(wc -l < "$f" 2>/dev/null)
    if [ "$lines" -gt 500 ]; then
      check_warn "$(basename "$f") is large ($size, $lines lines)"
      if [ "$FIX_MODE" = true ]; then
        > "$f"
        echo -e "    ${GREEN}→ Truncated${NC}"
      fi
    else
      check_pass "$(basename "$f") ($size, $lines lines)"
    fi
  done
done

# ═══════════════════════════════════════════════════════════
# 9. SYSTEMD SERVICE
# ═══════════════════════════════════════════════════════════
header "9. Systemd Service"

# Check both possible service file locations
SERVICE_FILE=""
for candidate in \
  "$HOME/.config/systemd/user/arch-systems.service" \
  "$HOME/.config/infra/systemd/user/arch-systems.service"; do
  if [ -f "$candidate" ]; then
    SERVICE_FILE="$candidate"
    break
  fi
done

if [ -n "$SERVICE_FILE" ]; then
  check_pass "Service file exists ($SERVICE_FILE)"
  if grep -qE "standalone/(apps/portal/server|Arch-System/apps/portal/server|server)\.js" "$SERVICE_FILE"; then
    check_pass "ExecStart uses standalone server.js"
  else
    check_fail "ExecStart does NOT use standalone server.js — fix required"
    if [ "$FIX_MODE" = true ]; then
      NODE_BIN=$(command -v node)
      sed -i "s|ExecStart=.*|ExecStart=$NODE_BIN $PORTAL_DIR/.next/standalone/Arch-System/apps/portal/server.js|" "$SERVICE_FILE"
      systemctl --user daemon-reload 2>/dev/null || true
      echo -e "    ${GREEN}→ Fixed ExecStart to use standalone server.js${NC}"
    fi
  fi

  if systemctl --user is-active arch-systems.service > /dev/null 2>&1; then
    check_pass "Service is active"
  else
    check_warn "Service is inactive"
  fi
else
  check_warn "Systemd service not installed"
fi

# ═══════════════════════════════════════════════════════════
# 10. CACHE & TEMP FILES
# ═══════════════════════════════════════════════════════════
header "10. Cache & Temp Files"

CLEAN_TARGETS=(
  "$REPO_ROOT/.turbo/cache"
  "$REPO_ROOT/apps/portal/.next/cache"
  "$REPO_ROOT/apps/cms/.next/cache"
  "$REPO_ROOT/apps/overview/.next/cache"
)

CLEAN_COUNT=0
for target in "${CLEAN_TARGETS[@]}"; do
  if [ -d "$target" ]; then
    size=$(du -sh "$target" 2>/dev/null | cut -f1)
    check_warn "Stale cache: $(basename "$target") ($size)"
    if [ "$FIX_MODE" = true ]; then
      rm -rf "$target"
      echo -e "    ${GREEN}→ Removed${NC}"
    fi
    CLEAN_COUNT=$((CLEAN_COUNT + 1))
  fi
done

if [ "$CLEAN_COUNT" -eq 0 ]; then
  check_pass "No stale caches"
fi

# ═══════════════════════════════════════════════════════════
# 11. MCP SERVERS
# ═══════════════════════════════════════════════════════════
header "11. MCP Servers"

if node "$REPO_ROOT/scripts/sync-mcp-config.js" > /dev/null 2>&1; then
  check_pass "MCP configurations synchronized (.mcp.json, .agents/mcp_config.json, .vscode/mcp.json)"
else
  check_fail "Failed to synchronize MCP configurations"
fi

if node "$REPO_ROOT/scripts/validate-mcp-servers.js"; then
  check_pass "All critical MCP servers verified and operational"
else
  check_fail "One or more MCP servers are offline or misconfigured"
fi

# ═══════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════
echo
if [ ${#ERRORS[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║          ALL CHECKS PASSED — READY TO DEPLOY               ║${NC}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  exit 0
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo -e "${RED}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}${BOLD}║          ${#ERRORS[@]} ERROR(S) — DEPLOYMENT BLOCKED          ${NC}"
  echo -e "${RED}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  for i in "${!ERRORS[@]}"; do
    echo -e "  ${RED}$((i+1)). ${ERRORS[$i]}${NC}"
  done
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo
  echo -e "${YELLOW}${BOLD}Warnings (${#WARNINGS[@]}):${NC}"
  for i in "${!WARNINGS[@]}"; do
    echo -e "  ${YELLOW}$((i+1)). ${WARNINGS[$i]}${NC}"
  done
fi

echo
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo -e "${YELLOW}Run with --fix to attempt automatic repairs.${NC}"
  echo -e "${YELLOW}Some fixes require manual intervention.${NC}"
  exit 1
else
  echo -e "${GREEN}No errors — warnings may be safe to ignore.${NC}"
  exit 0
fi
