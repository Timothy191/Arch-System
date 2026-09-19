#!/bin/bash
if [[ -n $(git status --porcelain) ]]; then
  echo "ERROR: Worktree is not clean."
  exit 1
fi

echo "[worktree-guard] Running Anti-Drift Guardian Check..."
if ! pnpm audit:antidrift; then
  echo "[worktree-guard] ERROR: Drift detected. Agent changes violate the governing line."
  exit 1
fi

exit 0
