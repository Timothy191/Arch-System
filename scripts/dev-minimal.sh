#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# Arch-Systems — Minimal Dev Script
# Starts Next.js portal with minimal checks for deployment/viewing
# ──────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"

# ── Colors ───────────────────────────────────────────────
DIM='\033[0;2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

PASS="${GREEN}${BOLD}  ✓${NC}"
FAIL="${RED}${BOLD}  ✗${NC}"
INFO="${CYAN}${BOLD}  →${NC}"

# ── Helpers ──────────────────────────────────────────────
check() {
  local label="$1" status="$2" detail="${3:-}"
  if [ "$status" = "pass" ]; then
    echo -e "  ${PASS} ${label}${detail:+ $DIM$detail$NC}"
  elif [ "$status" = "fail" ]; then
    echo -e "  ${FAIL} ${label}${detail:+ $RED$detail$NC}"
  elif [ "$status" = "warn" ]; then
    echo -e "  ${YELLOW}${BOLD}  ⚠${NC} ${label}${detail:+ $YELLOW$detail$NC}"
  fi
}

cleanup() {
  echo
  echo -e "  ${YELLOW}Shutting down...${NC}"
  [ -f "$REPO_ROOT/run/.portal.pid" ] && kill "$(cat "$REPO_ROOT/run/.portal.pid")" 2>/dev/null || true
  rm -f "$REPO_ROOT/run/.portal.pid"
}
trap cleanup EXIT INT TERM

# ══════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════

echo -e "  ${BOLD}${CYAN}Arch-Systems — Minimal Dev${NC}"
echo

# ── Environment Checks ───────────────────────────────────
env_pass=true
node -v > /dev/null 2>&1 && check "Node.js" "pass" "$(node -v)" || { check "Node.js" "fail"; env_pass=false; }
pnpm -v > /dev/null 2>&1 && check "pnpm" "pass" "$(pnpm -v)" || { check "pnpm" "fail"; env_pass=false; }

[ "$env_pass" = false ] && { echo -e "\n  ${RED}Environment checks failed. Aborting.${NC}\n"; exit 1; }

# ── Environment File ──────────────────────────────────────
if [ ! -f "$REPO_ROOT/apps/portal/.env" ] && [ ! -f "$REPO_ROOT/apps/portal/.env.local" ]; then
  if [ -f "$REPO_ROOT/apps/portal/env/.env.example" ]; then
    echo -e "  ${INFO} Apps portal .env missing. Copying from env/.env.example..."
    cp "$REPO_ROOT/apps/portal/env/.env.example" "$REPO_ROOT/apps/portal/.env"
    check "Environment file" "pass" "copied from template"
  elif [ -f "$REPO_ROOT/apps/portal/.env.example" ]; then
    echo -e "  ${INFO} Apps portal .env missing. Copying from .env.example..."
    cp "$REPO_ROOT/apps/portal/.env.example" "$REPO_ROOT/apps/portal/.env"
    check "Environment file" "pass" "copied from template"
  else
    check "Environment file" "fail" "missing and no .env.example found"
    exit 1
  fi
else
  check "Environment file" "pass" "exists"
fi

# ── Dependencies ──────────────────────────────────────────
if [ -d "$REPO_ROOT/node_modules" ]; then
  check "Dependencies" "pass"
else
  echo -e "  ${INFO} Installing dependencies..."
  pnpm install > /dev/null 2>&1 && check "Dependencies" "pass" || { check "Dependencies" "fail"; exit 1; }
fi

# ── Start Portal ─────────────────────────────────────────
mkdir -p "$REPO_ROOT/run"
cd "$REPO_ROOT/apps/portal"
PORT=$PORT NODE_OPTIONS="${NODE_OPTIONS:- --max-old-space-size=4096}" pnpm dev > "$REPO_ROOT/run/portal.log" 2>&1 &
echo $! > "$REPO_ROOT/run/.portal.pid"
cd "$REPO_ROOT"
echo -e "  ${INFO} Starting Next.js dev server..."

# ── Wait for Portal ───────────────────────────────────────
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
  check "Dev server" "pass" "http://localhost:$PORT (compiled)"
else
  check "Dev server" "fail"
  echo -e "\n  ${RED}Last 20 lines of portal.log:${NC}"
  tail -20 "$REPO_ROOT/run/portal.log" 2>/dev/null | sed 's/^/  /'
  exit 1
fi

# ── Done ─────────────────────────────────────────────────
echo
echo -e "  ${GREEN}${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
echo -e "  ${GREEN}${BOLD}│  Portal ready — viewing pages enabled                  │${NC}"
echo -e "  ${GREEN}${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
echo
echo -e "  ${BOLD}Portal:${NC}   ${CYAN}http://localhost:$PORT${NC}"
echo -e "  ${BOLD}Login:${NC}    ${CYAN}http://localhost:$PORT/login${NC}"
echo
echo -e "  ${DIM}Stop with Ctrl+C${NC}"
echo

wait
