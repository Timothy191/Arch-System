#!/usr/bin/env bash
# .agents/loops/runner.sh
# Local-First Agentic Loop Runner (Omnius + Agentic Loops Engine)

set -euo pipefail

LOOPS_DIR=".agents/loops"
WORKTREES_DIR=".agents/worktrees"
STATE_FILE="$LOOPS_DIR/current_state.json"

mkdir -p "$LOOPS_DIR"
mkdir -p "$WORKTREES_DIR"

command_usage() {
  cat <<EOF
Usage: runner.sh [OPTIONS]

Options:
  --goal <text>         Set execution goal for autonomous agent loop
  --steps <number>      Maximum step budget (default: 10)
  --runner <name>       Agent runner (antigravity, claude, codex) (default: antigravity)
  --dry-run             Validate state and verification gates without modifications
  --status              Print current active loop status
  --help                Show this help message
EOF
  exit 0
}

GOAL=""
STEPS=10
RUNNER="antigravity"
DRY_RUN=false
SHOW_STATUS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --goal)
      GOAL="$2"
      shift 2
      ;;
    --steps)
      STEPS="$2"
      shift 2
      ;;
    --runner)
      RUNNER="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --status)
      SHOW_STATUS=true
      shift
      ;;
    --help)
      command_usage
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ "$SHOW_STATUS" = true ]; then
  if [ -f "$STATE_FILE" ]; then
    cat "$STATE_FILE"
  else
    echo '{"status": "IDLE", "message": "No active agentic loop running."}'
  fi
  exit 0
fi

if [ -z "$GOAL" ]; then
  echo "Error: --goal is required to initiate an agentic loop." >&2
  exit 1
fi

LOOP_ID="loop-$(date +%s)"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "=== Initializing Agentic Loop: $LOOP_ID ==="
echo "Goal: $GOAL"
echo "Runner: $RUNNER | Max Steps: $STEPS"

# Initialize State JSON
cat <<EOF > "$STATE_FILE"
{
  "loop_id": "$LOOP_ID",
  "goal": "$GOAL",
  "phase": "COLLECT",
  "runner": "$RUNNER",
  "budget": {
    "max_steps": $STEPS,
    "current_step": 0,
    "timeout_seconds": 600
  },
  "created_at": "$TIMESTAMP",
  "verification_gates": [
    "pnpm --filter @repo/shared/hooks type-check"
  ]
}
EOF

if [ "$DRY_RUN" = true ]; then
  echo "Dry-run mode active. Validating verification gates..."
  pnpm --filter @repo/shared/hooks type-check
  echo "Dry-run verification gates passed successfully."
  exit 0
fi

echo "Loop state initialized at $STATE_FILE."
echo "Ready for autonomous dispatch."
exit 0
