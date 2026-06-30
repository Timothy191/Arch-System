#!/usr/bin/env bash
# sessionStart — generate auto-recall suggestions
set -euo pipefail

REPO_ROOT="${CURSOR_PROJECT_DIR:-$(pwd)}"
python3 "$REPO_ROOT/scripts/memory/hooks/auto-recall.py" 2>/dev/null || true

exit 0