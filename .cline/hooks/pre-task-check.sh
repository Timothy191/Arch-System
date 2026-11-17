#!/usr/bin/env bash
set -euo pipefail

# Cline pre-task check: ensure we're in Arch-System/ and on a branch
repo="${QODER_PROJECT_DIR:-$PWD}"
if [[ "$repo" != */Arch-System ]]; then
  echo "cline-pre-task-check: not inside Arch-System/ — cd to /home/tim/Fork/Arch-System first" >&2
  exit 1
fi

cd "$repo"

# Verify we're on a feature branch (not main directly)
branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")
if [[ "$branch" == "main" || "$branch" == "master" ]]; then
  echo "cline-pre-task-check: WARNING — on '$branch'. Create a feature branch first: git checkout -b <type>/<scope>" >&2
  exit 1
fi

# Remind of onboarding spine, VibeMon telemetry, and verification gates
if [[ -x "$repo/tools/scripts/vibemon-track.sh" ]]; then
  bash "$repo/tools/scripts/vibemon-track.sh" track session_start cline >/dev/null 2>&1 || true
fi
if [[ -f "$repo/.handoff/handoff.md" ]]; then
  echo "cline-pre-task-check: auto-onboarding spine found at .handoff/handoff.md — read it or call memory-gateway-mcp get_session_onboarding before starting."
fi
echo "cline-pre-task-check: branch='$branch' — remember: pnpm agent:verify → type-check → lint → test → audit:compliance"

exit 0