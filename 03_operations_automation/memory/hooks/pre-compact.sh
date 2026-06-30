#!/usr/bin/env bash
# preCompact — mark compact pending for agent protocol
set -euo pipefail

REPO_ROOT="${CURSOR_PROJECT_DIR:-$(pwd)}"
# shellcheck source=../memory-paths.sh
source "$REPO_ROOT/03_operations_automation/memory/memory-paths.sh"

STATE="$CURSOR_MEMORY_DIR/state.json"
PENDING="$CURSOR_MEMORY_DIR/.compact-pending"
mkdir -p "$CURSOR_MEMORY_DIR"

if [ -f "$STATE" ]; then
  python3 - "$STATE" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = json.loads(path.read_text(encoding="utf-8"))
data["compact_pending"] = True
path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PY
fi

echo "preCompact" >"$PENDING"
exit 0
