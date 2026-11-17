#!/usr/bin/env bash
set -euo pipefail

# Cline pre-flight check for SWE agent tasks
# Verifies: Arch-System/ cwd, feature branch, A2A bus readiness, verification tooling available

repo="${QODER_PROJECT_DIR:-$PWD}"
if [[ "$repo" != */Arch-System ]]; then
  echo "cline-swe-pre-flight: not inside Arch-System/ — cd to /home/tim/Fork/Arch-System first" >&2
  exit 1
fi

cd "$repo"

# Verify we're on a feature branch (not main directly)
branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")
if [[ "$branch" == "main" || "$branch" == "master" ]]; then
  echo "cline-swe-pre-flight: ERROR — on '$branch'. Create a feature branch first: git checkout -b <type>/<scope>" >&2
  exit 1
fi

# Verify A2A bus exists
if [[ ! -f .agents/a2a/bus/event-log.jsonl ]]; then
  echo "cline-swe-pre-flight: ERROR — A2A event bus not found at .agents/a2a/bus/event-log.jsonl" >&2
  exit 1
fi

# Verify SWE agent registry card exists
if [[ ! -f .agents/a2a/registry/swe-agent.json ]]; then
  echo "cline-swe-pre-flight: ERROR — SWE agent registry card not found" >&2
  exit 1
fi

# Verify verification tooling is available
if ! command -v pnpm >/dev/null 2>&1; then
  echo "cline-swe-pre-flight: ERROR — pnpm not found in PATH" >&2
  exit 1
fi

echo "cline-swe-pre-flight: OK — branch='$branch', A2A bus ready, SWE agent registered, verification tooling available"

exit 0