#!/usr/bin/env bash
# ==============================================================================
# Arch-Systems Portal — Production Environment Pre-Flight Verification Script
# ==============================================================================
# Checks .env.production configuration, Node.js runtime, standalone Next.js 16
# build artifacts, and static asset distribution prior to production release.
#
# Usage:
#   ./scripts/verify-prod-env.sh [PATH_TO_ENV_FILE]
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
BOLD="\033[1m"
NC="\033[0m" # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${1:-${REPO_ROOT}/.env.production}"
if [ ! -f "$ENV_FILE" ] && [ -f "${REPO_ROOT}/apps/portal/.env.production" ]; then
  ENV_FILE="${REPO_ROOT}/apps/portal/.env.production"
elif [ ! -f "$ENV_FILE" ] && [ -f "${REPO_ROOT}/.env" ]; then
  ENV_FILE="${REPO_ROOT}/.env"
fi

ERRORS=0
WARNINGS=0

log_header() {
  echo -e "\n${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
}

log_pass() {
  echo -e "  [${GREEN}✓ PASS${NC}] $1"
}

log_warn() {
  echo -e "  [${YELLOW}⚠ WARN${NC}] $1"
  WARNINGS=$((WARNINGS + 1))
}

log_fail() {
  echo -e "  [${RED}✗ FAIL${NC}] $1"
  ERRORS=$((ERRORS + 1))
}

# ------------------------------------------------------------------------------
# 1. Environment File Check
# ------------------------------------------------------------------------------
log_header "1. Production Environment Configuration (.env)"

if [ ! -f "$ENV_FILE" ]; then
  log_fail "Environment file not found: $ENV_FILE"
  echo -e "         ${YELLOW}Suggestion: Create it from template:${NC}"
  echo -e "         cp apps/portal/env/.env.production.example .env.production"
else
  log_pass "Found environment file: $ENV_FILE"

  # Load variables safely without executing commands
  # Export parsed keys to test presence
  while IFS='=' read -r key value || [ -n "$key" ]; do
    # Strip comments and trim whitespace
    key=$(echo "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [[ ! "$key" =~ ^# ]] && [[ -n "$key" ]]; then
      value=$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
      eval "ENV_${key}=\"${value}\""
    fi
  done < "$ENV_FILE"

  # Check Supabase URL
  SUPA_URL="${ENV_NEXT_PUBLIC_SUPABASE_URL:-${ENV_SUPABASE_URL:-}}"
  if [ -z "$SUPA_URL" ]; then
    log_fail "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) is missing"
  elif [[ "$SUPA_URL" =~ ^https?:// ]]; then
    if [[ "$SUPA_URL" =~ localhost|127\.0\.0\.1 ]]; then
      log_warn "NEXT_PUBLIC_SUPABASE_URL points to localhost ($SUPA_URL). Ensure this is intentional for cloud production."
    else
      log_pass "NEXT_PUBLIC_SUPABASE_URL is configured ($SUPA_URL)"
    fi
  else
    log_fail "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP/HTTPS URL: $SUPA_URL"
  fi

  # Check Supabase Anon Key (per Supabase docs: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  SUPA_ANON="${ENV_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${ENV_NEXT_PUBLIC_SUPABASE_ANON_KEY:-${ENV_SUPABASE_PUBLISHABLE_KEY:-${ENV_SUPABASE_ANON_KEY:-}}}}"
  if [ -z "$SUPA_ANON" ] || [[ "$SUPA_ANON" == *"your_supabase_anon_key"* ]] || [[ "$SUPA_ANON" == *"<your-anon-key>"* ]]; then
    log_fail "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is missing or contains placeholder text"
  else
    log_pass "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is present"
  fi

  # Check Supabase Service Key
  SUPA_SERVICE="${ENV_SUPABASE_SERVICE_KEY:-${ENV_SUPABASE_SERVICE_ROLE_KEY:-}}"
  if [ -z "$SUPA_SERVICE" ] || [[ "$SUPA_SERVICE" == *"your_supabase_service_key"* ]] || [[ "$SUPA_SERVICE" == *"<your-service-role-key>"* ]]; then
    log_fail "SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing or contains placeholder text"
  else
    log_pass "SUPABASE_SERVICE_KEY is present"
  fi

  # Check Database Connection String
  DB_URL="${ENV_DATABASE_URL:-${ENV_DATABASE_POOLER_URL:-}}"
  if [ -z "$DB_URL" ]; then
    log_warn "DATABASE_URL / DATABASE_POOLER_URL not defined (needed if running direct SQL migrations/Prisma)"
  else
    log_pass "DATABASE_URL is defined"
  fi

  # Check Redis
  REDIS="${ENV_REDIS_URL:-}"
  if [ -z "$REDIS" ]; then
    log_warn "REDIS_URL is not set. Cache/rate-limiting fallback may operate in memory."
  else
    log_pass "REDIS_URL is configured"
  fi

  # Check NODE_ENV
  NODE_ENV_VAL="${ENV_NODE_ENV:-}"
  if [ "$NODE_ENV_VAL" != "production" ]; then
    log_warn "NODE_ENV is not explicitly set to 'production' (current: '${NODE_ENV_VAL}')"
  else
    log_pass "NODE_ENV is set to 'production'"
  fi
fi

# ------------------------------------------------------------------------------
# 2. Runtime & Monorepo Engine Checks
# ------------------------------------------------------------------------------
log_header "2. Runtime Environment & Toolchain"

# Check Node version
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 20 ]; then
    log_pass "Node.js version v$NODE_VER is supported (>= 20)"
  else
    log_fail "Node.js version v$NODE_VER is outdated. Monorepo requires Node >= 20 (recommended: 22+)"
  fi
else
  log_fail "Node.js binary not found in PATH"
fi

# Check pnpm
if command -v pnpm >/dev/null 2>&1; then
  PNPM_VER=$(pnpm -v)
  log_pass "pnpm package manager v$PNPM_VER installed"
else
  log_fail "pnpm is not installed. Install via: corepack enable && corepack prepare pnpm@9.15.9 --activate"
fi

# ------------------------------------------------------------------------------
# 3. Next.js Standalone Build Artifacts
# ------------------------------------------------------------------------------
log_header "3. Next.js 16 Standalone Build Artifacts"

STANDALONE_DIR="${REPO_ROOT}/apps/portal/.next/standalone"
SERVER_JS="${STANDALONE_DIR}/apps/portal/server.js"
STATIC_DIR="${STANDALONE_DIR}/apps/portal/.next/static"
PUBLIC_DIR="${STANDALONE_DIR}/apps/portal/public"

if [ -f "$SERVER_JS" ]; then
  log_pass "Standalone server entrypoint found: apps/portal/.next/standalone/apps/portal/server.js"
else
  log_fail "Standalone server entrypoint missing: $SERVER_JS"
  echo -e "         ${YELLOW}Run: pnpm --filter portal build${NC}"
fi

# Check Static Assets in Standalone
if [ -d "$STATIC_DIR" ] && [ "$(ls -A "$STATIC_DIR" 2>/dev/null)" ]; then
  log_pass "Static assets synced to standalone directory (.next/static)"
else
  log_warn "Static assets missing in standalone: $STATIC_DIR"
  echo -e "         ${YELLOW}Run: cp -r apps/portal/.next/static apps/portal/.next/standalone/apps/portal/.next/static${NC}"
fi

# Check Public Directory in Standalone
if [ -d "$PUBLIC_DIR" ]; then
  log_pass "Public assets synced to standalone directory (public/)"
else
  log_warn "Public assets directory missing in standalone: $PUBLIC_DIR"
  echo -e "         ${YELLOW}Run: cp -r apps/portal/public apps/portal/.next/standalone/apps/portal/public${NC}"
fi

# ------------------------------------------------------------------------------
# 4. Summary & Exit
# ------------------------------------------------------------------------------
log_header "4. Pre-Flight Verification Summary"

echo -e "  Critical Errors : ${BOLD}$([ $ERRORS -eq 0 ] && echo -e "${GREEN}0" || echo -e "${RED}${ERRORS}")${NC}"
echo -e "  Warnings        : ${BOLD}$([ $WARNINGS -eq 0 ] && echo -e "${GREEN}0" || echo -e "${YELLOW}${WARNINGS}")${NC}"

if [ $ERRORS -eq 0 ]; then
  echo -e "\n${BOLD}${GREEN}✔ SUCCESS: Production pre-flight verification passed.${NC} System is ready for deployment.\n"
  exit 0
else
  echo -e "\n${BOLD}${RED}✖ FAILED: $ERRORS critical error(s) must be resolved before proceeding with production deployment.${NC}\n"
  exit 1
fi
