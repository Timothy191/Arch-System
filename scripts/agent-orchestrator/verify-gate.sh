#!/usr/bin/env bash
# Verification gate — Fable 5 / Opus 4.8 "test own work before reporting" pattern.
# Run before claiming done, opening PR, or /summarize wrap-up.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

info() { echo -e "${YELLOW}→${NC} $*"; }
pass() { echo -e "${GREEN}✓${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; FAILED=1; }

# Detect touched areas from git (staged + unstaged vs HEAD)
CHANGED="$(git diff --name-only HEAD 2>/dev/null || true)"
STAGED="$(git diff --cached --name-only 2>/dev/null || true)"
ALL="$(printf '%s\n%s' "$CHANGED" "$STAGED" | sort -u | grep -v '^$' || true)"

record_verify() {
  local flag="$1"
  python3 "$ROOT/scripts/agent-orchestrator/turn-session.py" record verify "$flag" >/dev/null 2>&1 || true
}

if [[ -z "$ALL" ]]; then
  pass "No file changes — verify gate skipped"
  record_verify --passed
  exit 0
fi

info "Changed files:"
echo "$ALL" | sed 's/^/  /'

touch_portal=false
touch_packages=false
touch_migrations=false
touch_policy=false
touch_e2e=false

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  [[ "$f" == apps/portal/* ]] && touch_portal=true
  [[ "$f" == packages/* ]] && touch_packages=true
  [[ "$f" == packages/database/migrations/* ]] && touch_migrations=true
  [[ "$f" == tools/policy-compiler.cjs ]] && touch_policy=true
  [[ "$f" == e2e/* ]] && touch_e2e=true
done <<< "$ALL"

run_scoped() {
  local filter="$1"
  info "pnpm --filter $filter lint"
  if pnpm --filter "$filter" lint; then
    pass "$filter lint"
  else
    fail "$filter lint"
  fi
  info "pnpm --filter $filter type-check"
  if pnpm --filter "$filter" type-check; then
    pass "$filter type-check"
  else
    fail "$filter type-check"
  fi
}

if $touch_portal; then
  run_scoped portal
fi

if $touch_packages && ! $touch_portal; then
  # Pick first touched package name
  pkg="$(echo "$ALL" | grep '^packages/' | head -1 | cut -d/ -f2)"
  if [[ -n "$pkg" ]]; then
    run_scoped "@repo/$pkg" 2>/dev/null || run_scoped "$pkg" 2>/dev/null || info "Could not auto-detect package filter for $pkg"
  fi
fi

if $touch_migrations; then
  info "pnpm audit:rls"
  if pnpm audit:rls; then
    pass "audit:rls"
  else
    fail "audit:rls"
  fi
fi

if $touch_policy; then
  info "pnpm policy:gen"
  if pnpm policy:gen; then
    pass "policy:gen"
  else
    fail "policy:gen"
  fi
fi

if $FAILED -ne 0; then
  echo ""
  fail "Verify gate FAILED — fix before claiming done"
  record_verify --failed
  exit 1
fi

pass "Verify gate passed"
record_verify --passed
exit 0
