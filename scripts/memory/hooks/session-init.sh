#!/usr/bin/env bash
# sessionStart — initialize .memory session state for context compaction
set -euo pipefail

REPO_ROOT="${CURSOR_PROJECT_DIR:-$(pwd)}"
STATE="$REPO_ROOT/.memory/state.json"
mkdir -p "$REPO_ROOT/.memory/sessions"

if [ ! -f "$STATE" ]; then
  cat >"$STATE" <<'EOF'
{
  "version": 1,
  "user_turns": 0,
  "last_compact_turn": 0,
  "compact_every_n_turns": 10,
  "auto_compact_enabled": true,
  "compact_pending": false,
  "last_compact_at": null,
  "last_compact_path": null
}
EOF
fi

exit 0
