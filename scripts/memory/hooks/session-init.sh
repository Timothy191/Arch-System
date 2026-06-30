#!/usr/bin/env bash
# sessionStart — initialize cursor memory session state for context compaction
set -euo pipefail

REPO_ROOT="${CURSOR_PROJECT_DIR:-$(pwd)}"
# shellcheck source=../memory-paths.sh
source "$REPO_ROOT/scripts/memory/memory-paths.sh"

STATE="$CURSOR_MEMORY_DIR/state.json"
mkdir -p "$CURSOR_MEMORY_SESSIONS_DIR"

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
