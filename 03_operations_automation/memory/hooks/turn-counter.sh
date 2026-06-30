#!/usr/bin/env bash
# beforeSubmitPrompt — count user turns; flag auto-compact near ~50% context budget
set -euo pipefail

REPO_ROOT="${CURSOR_PROJECT_DIR:-$(pwd)}"
# shellcheck source=../memory-paths.sh
source "$REPO_ROOT/03_operations_automation/memory/memory-paths.sh"

STATE="$CURSOR_MEMORY_DIR/state.json"
PENDING="$CURSOR_MEMORY_DIR/.compact-pending"
mkdir -p "$CURSOR_MEMORY_DIR"

input=$(cat)

# Only count real user submits (not empty)
prompt=$(echo "$input" | jq -r '.prompt // .text // empty' 2>/dev/null || true)
if [ -z "$prompt" ]; then
  exit 0
fi

if [ ! -f "$STATE" ]; then
  bash "$REPO_ROOT/03_operations_automation/memory/hooks/session-init.sh" </dev/null
fi

# Skip counter for explicit /summarize (handled by agent rule)
if echo "$prompt" | grep -qE '^/summarize\b'; then
  exit 0
fi

tmp=$(mktemp)
jq '.user_turns = ((.user_turns // 0) + 1)' "$STATE" >"$tmp"
mv "$tmp" "$STATE"

user_turns=$(jq -r '.user_turns' "$STATE")
last_compact=$(jq -r '.last_compact_turn // 0' "$STATE")
every_n=$(jq -r '.compact_every_n_turns // 10' "$STATE")
enabled=$(jq -r '.auto_compact_enabled // true' "$STATE")

since=$((user_turns - last_compact))

if [ "$enabled" = "true" ] && [ "$since" -ge "$every_n" ]; then
  jq '.compact_pending = true' "$STATE" >"$tmp"
  mv "$tmp" "$STATE"
  printf '%s\n' "{\"reason\":\"turn_threshold\",\"user_turns\":$user_turns,\"since_last_compact\":$since,\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >"$PENDING"
fi

exit 0
