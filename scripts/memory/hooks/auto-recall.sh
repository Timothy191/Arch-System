#!/usr/bin/env bash
# sessionStart — build auto-recall brief for agent turn start
set -euo pipefail

REPO_ROOT="${CURSOR_PROJECT_DIR:-$(pwd)}"
python3 "$REPO_ROOT/scripts/memory/auto-recall.py" --trigger sessionStart >/dev/null 2>&1 || true
exit 0
