#!/usr/bin/env bash
# ==============================================================================
# Arch-Systems Portal — Production Environment Pre-Flight Verification Script
# ==============================================================================
# Checks .env.production configuration, Node.js runtime, standalone Next.js 16
# build artifacts, and static asset distribution prior to production release.
#
# Usage: ./scripts/verify-prod-env.sh [PATH_TO_ENV_FILE]
# Uses: scripts/lib/common.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

LOG_LABEL="[verify-prod]"

ENV_FILE="${1:-$REPO_ROOT/.env.production}"
if [ ! -f "$ENV_FILE" ] && [ -f "$REPO_ROOT/apps/portal/.env.production" ]; then
  ENV_FILE="$REPO_ROOT/apps/portal/.env.production"
elif [ ! -f "$ENV_FILE" ] && [ -f "$REPO_ROOT/.env" ]; then
  ENV_FILE="$REPO_ROOT/.env"
fi

ERRORS=0
WARNINGS=0

log_header() {
  echo
  echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
}

log_pass() {
  echo -e "  [${GREEN}✓ PASS${NC}] $1"
  ERRORS=$((ERRORS))  # no-op, keeps var referenced
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

  # Safe parsing: use get_env_var (no eval) for each variable we need to check.
  # This avoids the security risk of eval on potentially untrusted env file content.

  # Check Supabase URL
  SUPA_URL=$(get_env_var "$ENV_FILE" "NEXT_PUBLIC_SUPABASE_URL")
  if [ -z "$SUPA_URL" ]; then
    SUPA_URL=$(get_env_var "$ENV_FILE" "SUPABASE_URL")
  fi
  if [ -z "$SUPA_URL" ]; then
    log_fail "NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) is missing"
  elif [[ "$SUPA_URL" =~ ^https?:// ]]; then
    if [[ "$SUPA_URL" == *localhost* ]] || [[ "$SUPA_URL" == *127.0.0.1* ]]; then
      log_warn "NEXT_PUBLIC_SUPABASE_URL points to localhost ($SUPA_URL). Ensure this is intentional for cloud production."
    else
      log_pass "NEXT_PUBLIC_SUPABASE_URL is configured ($SUPA_URL)"
    fi
  else
    log_fail "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP/HTTPS URL: $SUPA_URL"
  fi

  # Check Supabase Anon Key (per Supabase docs: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  SUPA_ANON=$(get_env_var "$ENV_FILE" "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  if [ -z "$SUPA_ANON" ]; then
    SUPA_ANON=$(get_env_var "$ENV_FILE" "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  fi
  if [ -z "$SUPA_ANON" ]; then
    SUPA_ANON=$(get_env_var "$ENV_FILE" "SUPABASE_PUBLISHABLE_KEY")
  fi
  if [ -z "$SUPA_ANON" ]; then
    SUPA_ANON=$(get_env_var "$ENV_FILE" "SUPABASE_ANON_KEY")
  fi
  if [ -z "$SUPA_ANON" ] || [[ "$SUPA_ANON" == *"your_supabase_anon_key"* ]] || [[ "$SUPA_ANON" == *"<your-anon-key>"* ]]; then
    log_fail "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is missing or contains placeholder text"
  else
    log_pass "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is present"
  fi

  # Check Supabase Service Key
  SUPA_SERVICE=$(get_env_var "$ENV_FILE" "SUPABASE_SERVICE_KEY")
  if [ -z "$SUPA_SERVICE" ]; then
    SUPA_SERVICE=$(get_env_var "$ENV_FILE" "SUPABASE_SERVICE_ROLE_KEY")
  fi
  if [ -z "$SUPA_SERVICE" ] || [[ "$SUPA_SERVICE" == *"your_supabase_service_key"* ]] || [[ "$SUPA_SERVICE" == *"<your-service-role-key>"* ]]; then
    log_fail "SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing or contains placeholder text"
  else
    log_pass "SUPABASE_SERVICE_KEY is present"
  fi

  # Check Database Connection String
  DB_URL=$(get_env_var "$ENV_FILE" "DATABASE_URL")
  if [ -z "$DB_URL" ]; then
    DB_URL=$(get_env_var "$ENV_FILE" "DATABASE_POOLER_URL")
  fi
  if [ -z "$DB_URL" ]; then
    log_warn "DATABASE_URL / DATABASE_POOLER_URL not defined (needed if running direct SQL migrations/Prisma)"
  else
    log_pass "DATABASE_URL is defined"
  fi

  # Check Redis
  REDIS=$(get_env_var "$ENV_FILE" "REDIS_URL")
  if [ -z "$REDIS" ]; then
    log_warn "REDIS_URL is not set. Cache/rate-limiting fallback may operate in memory."
  else
    log_pass "REDIS_URL is configured"
  fi

  # Check NODE_ENV
  NODE_ENV_VAL=$(get_env_var "$ENV_FILE" "NODE_ENV")
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
if command -v node > /dev/null 2>&1; then
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
if command -v pnpm > /dev/null 2>&1; then
  PNPM_VER=$(pnpm -v)
  log_pass "pnpm package manager v$PNPM_VER installed"
else
  log_fail "pnpm is not installed. Install via: corepack enable && corepack prepare pnpm@9.15.9 --activate"
fi

# ------------------------------------------------------------------------------
# 3. Next.js Standalone Build Artifacts
# ------------------------------------------------------------------------------
log_header "3. Next.js 16 Standalone Build Artifacts"

STANDALONE_DIR="$REPO_ROOT/apps/portal/.next/standalone"
SERVER_JS=""

# Check all known standalone entrypoint paths
for candidate in \
  "${STANDALONE_DIR}/apps/portal/server.js" \
  "${STANDALONE_DIR}/Arch-System/apps/portal/server.js" \
  "${STANDALONE_DIR}/server.js"; do
  if [ -f "$candidate" ]; then
    SERVER_JS="$candidate"
    break
  fi
done

if [ -n "$SERVER_JS" ]; then
  log_pass "Standalone server entrypoint found: ${SERVER_JS#$REPO_ROOT/}"
else
  log_fail "Standalone server entrypoint missing under $STANDALONE_DIR"
  echo -e "         ${YELLOW}Run: pnpm --filter portal build${NC}"
fi

# Check Static Assets in Standalone
STATIC_DIR="${STANDALONE_DIR}/apps/portal/.next/static"
if [ -d "$STATIC_DIR" ] && [ "$(ls -A "$STATIC_DIR" 2>/dev/null)" ]; then
  log_pass "Static assets synced to standalone directory (.next/static)"
else
  log_warn "Static assets missing in standalone: $STATIC_DIR"
  echo -e "         ${YELLOW}Run: cp -r apps/portal/.next/static apps/portal/.next/standalone/apps/portal/.next/static${NC}"
fi

# Check Public Directory in Standalone
PUBLIC_DIR="${STANDALONE_DIR}/apps/portal/public"
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
  echo -e "\n${BOLD}${GREEN}✔ SUCCESS: Production pre-flight verification passed. System is ready for deployment.${NC}\n"
  exit 0
else
  echo -e "\n${BOLD}${RED}✖ FAILED: $ERRORS critical error(s) must be resolved before proceeding with production deployment.${NC}\n"
  exit 1
fi
