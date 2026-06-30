#!/usr/bin/env bash
# preCompact — Cursor is compacting context; queue memory archival
set -euo pipefail

REPO_ROOT="${CURSOR_PROJECT_DIR:-$(pwd)}"
STATE="$REPO_ROOT/.memory/state.json"
PENDING="$REPO_ROOT/.memory/.compact-pending"
mkdir -p "$REPO_ROOT/.memory"

if [ ! -f "$STATE" ]; then
  bash "$REPO_ROOT/scripts/memory/hooks/session-init.sh" </dev/null
fi

tmp=$(mktemp)
jq '.compact_pending = true' "$STATE" >"$tmp"
mv "$tmp" "$STATE"

printf '%s\n' "{\"reason\":\"pre_compact\",\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >"$PENDING"

exit 0
