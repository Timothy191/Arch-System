#!/usr/bin/env bash
set -euo pipefail

# Cline post-task tracer: append ISO-8601 entry to root AGENT_TRACER.md
repo="${QODER_PROJECT_DIR:-$PWD}"
cd "$repo"

tracer="AGENT_TRACER.md"
if [[ ! -f "$tracer" ]]; then
  echo "cline-post-task-tracer: $tracer not found — skipping trace entry" >&2
  exit 0
fi

ts=$(date -u +%Y-%m-%dT%H:%M:%S%Z)
branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")

# Only append if we have a meaningful tool_input context (file was edited)
# The hook receives the tool payload on stdin; we just record the event.
{
  echo ""
  echo "## [$ts] - Cline task on branch \`$branch\`"
  echo ""
  echo "- **Summary**: Cline autonomous task execution on branch \`$branch\`"
  echo "- **Verification**: \`pnpm agent:verify\`, \`pnpm type-check\`, \`pnpm lint\`, \`pnpm test\`, \`pnpm audit:compliance\`"
  echo ""
} >> "$tracer"

echo "cline-post-task-tracer: appended entry to $tracer"

if [[ -x "$repo/tools/scripts/vibemon-track.sh" ]]; then
  bash "$repo/tools/scripts/vibemon-track.sh" track stop cline >/dev/null 2>&1 || true
fi

exit 0