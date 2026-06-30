#!/usr/bin/env bash
# Environmental health verification script for Arch-Systems monorepo onboarding.
set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS="${GREEN}${BOLD}✓${NC}"
FAIL="${RED}${BOLD}✗${NC}"
WARN="${YELLOW}${BOLD}⚠${NC}"
INFO="${CYAN}${BOLD}→${NC}"

echo -e "${BOLD}${BLUE}=== Arch-Systems Environment Verification ===${NC}"
echo

# 1. Check Node.js
NODE_VER=$(node -v 2>/dev/null || echo "None")
if [ "$NODE_VER" = "None" ]; then
  echo -e "  [${FAIL}] Node.js: Not installed (Required: >=22)"
else
  NODE_MAJOR=$(echo "$NODE_VER" | sed -E 's/v([0-9]+)\..*/\1/')
  if [ "$NODE_MAJOR" -ge 22 ]; then
    if [ "$NODE_VER" = "v24.15.0" ]; then
      echo -e "  [${PASS}] Node.js: $NODE_VER (Matches Volta pin)"
    else
      echo -e "  [${PASS}] Node.js: $NODE_VER (Required >=22 met, but Volta pins v24.15.0)"
    fi
  else
    echo -e "  [${FAIL}] Node.js: $NODE_VER (Required: >=22)"
  fi
fi

# 2. Check pnpm
PNPM_VER=$(pnpm -v 2>/dev/null || echo "None")
if [ "$PNPM_VER" = "None" ]; then
  echo -e "  [${FAIL}] pnpm: Not installed (Required: 9.15.9)"
else
  if [ "$PNPM_VER" = "9.15.9" ]; then
    echo -e "  [${PASS}] pnpm: $PNPM_VER (Matches pinned version)"
  else
    echo -e "  [${WARN}] pnpm: $PNPM_VER (Expected: 9.15.9)"
  fi
fi

# 3. Check Docker status
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo -e "  [${PASS}] Docker: Running"
    DOCKER_ACTIVE=true
  else
    echo -e "  [${WARN}] Docker: Installed but daemon is not running (Required for local DB/Redis)"
    DOCKER_ACTIVE=false
  fi
else
  echo -e "  [${WARN}] Docker: Not installed (Required for local DB/Redis)"
  DOCKER_ACTIVE=false
fi

# 4. Check Redis offload container/port
if [ "$DOCKER_ACTIVE" = true ]; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^arch-redis-offload'; then
    echo -e "  [${PASS}] Redis Container: arch-redis-offload is running"
  else
    echo -e "  [${WARN}] Redis Container: arch-redis-offload is not running (Run 'pnpm redis:dev')"
  fi
else
  if (timeout 1 bash -c "echo >/dev/tcp/127.0.0.1/6380") 2>/dev/null; then
    echo -e "  [${PASS}] Redis Port: 6380 is open"
  else
    echo -e "  [${WARN}] Redis: Unreachable on port 6380 (Run 'pnpm redis:dev')"
  fi
fi

# 5. Check Supabase / Postgres container/port
if [ "$DOCKER_ACTIVE" = true ]; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'supabase'; then
    echo -e "  [${PASS}] Supabase Containers: Running"
  else
    echo -e "  [${WARN}] Supabase Containers: Not running (Run 'pnpm --filter @repo/database supabase:dev')"
  fi
else
  if (timeout 1 bash -c "echo >/dev/tcp/127.0.0.1/54322") 2>/dev/null; then
    echo -e "  [${PASS}] Supabase DB Port: 54322 is open"
  else
    echo -e "  [${WARN}] Supabase DB: Unreachable on port 54322 (Run 'pnpm --filter @repo/database supabase:dev')"
  fi
fi

# 6. Check node_modules
if [ -d "node_modules" ]; then
  echo -e "  [${PASS}] Root node_modules: Found"
else
  echo -e "  [${FAIL}] Root node_modules: Missing (Run 'pnpm install')"
fi

if [ -d "00_applications/portal/node_modules" ]; then
  echo -e "  [${PASS}] Portal node_modules: Found"
else
  echo -e "  [${FAIL}] Portal node_modules: Missing (Run 'pnpm install')"
fi

# 7. Check Environment Files
if [ -f "00_applications/portal/.env" ]; then
  echo -e "  [${PASS}] Portal .env file: Configured"
else
  echo -e "  [${WARN}] Portal .env file: Missing (Copy from 00_applications/portal/env/.env.example to 00_applications/portal/.env)"
fi

echo
echo -e "${BOLD}${BLUE}=== Setup Actions Checklist ===${NC}"
echo -e "  1. Install dependencies:  ${CYAN}pnpm install${NC}"
echo -e "  2. Start Local Database:  ${CYAN}pnpm --filter @repo/database supabase:dev${NC}"
echo -e "  3. Start Redis Stack:    ${CYAN}pnpm redis:dev${NC}"
echo -e "  4. Start Dev Server:      ${CYAN}pnpm dev${NC}"
echo -e "  5. Run Quality Checks:    ${CYAN}pnpm quality${NC}"
echo
