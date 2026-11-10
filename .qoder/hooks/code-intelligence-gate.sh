#!/usr/bin/env bash
# code-intelligence-gate.sh — PostToolUse hook (matcher: Edit|Write)
#
# Runs the Code-Intelligence Substrate Integrity gate on every file edit so the
# drift guard is ALWAYS APPLIED, not only when an agent remembers to run
# `pnpm agent:verify`.
#
# Non-blocking by design: it prints a ⚠ advisory when the substrate has drifted
# (so the agent is informed at edit time) but never exits non-zero, because a
# stale index must not freeze legitimate feature work. The hard block lives in
# .husky/pre-commit (protecting the enforcement machinery itself from being
# committed in a disabled state).
#
# The gate is cheap (~150ms, read-only SQLite) and skips silently when the DB
# or the audit script is unavailable (e.g. CI without the index built).

set -uo pipefail

ROOT="${QODER_PROJECT_DIR:-$PWD}"
AUDIT="$ROOT/tools/audits/audit-code-intelligence-drift.cjs"

[ -f "$AUDIT" ] || exit 0

if ! command -v node >/dev/null 2>&1; then
  exit 0
fi

out="$(node "$AUDIT" 2>&1)" || true

if printf '%s' "$out" | grep -q '✅ PASS'; then
  exit 0
fi

# Surface the drift condition to the editing agent without blocking it.
printf '\n⚠ [CODE-INTEL] Substrate drift detected while editing. Structural claims made now are void.\n'
printf '%s\n' "$out" | sed 's/^/  /'
printf '  RESOLVE: pnpm ci:reindex && pnpm ci:snapshot && pnpm audit:code-intelligence\n'
exit 0