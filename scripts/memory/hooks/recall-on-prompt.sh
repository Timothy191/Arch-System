#!/usr/bin/env bash
# beforeSubmitPrompt — refresh auto-recall brief from latest user message
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

export RECALL_PROMPT="$prompt"
python3 "$REPO_ROOT/scripts/memory/auto-recall.py" \
  --trigger beforeSubmitPrompt \
  --prompt "$RECALL_PROMPT" >/dev/null 2>&1 || true

exit 0
