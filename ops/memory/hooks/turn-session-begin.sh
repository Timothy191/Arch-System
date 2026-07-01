#!/usr/bin/env bash
# beforeSubmitPrompt — start turn session (tier, git snapshot, HOW baseline)
set -euo pipefail

REPO_ROOT="${CURSOR_PROJECT_DIR:-$(pwd)}"
input=$(cat)

prompt=$(echo "$input" | jq -r '.prompt // .text // empty' 2>/dev/null || true)
if [ -z "$prompt" ]; then
  exit 0
fi

if echo "$prompt" | grep -qE '^/summarize\b'; then
  exit 0
fi

python3 "$REPO_ROOT/03_operations_automation/agent-orchestrator/turn-session.py" begin --prompt "$prompt" >/dev/null 2>&1 || true
exit 0
