#!/bin/bash
# Stop hook: a dirty worktree is expected mid-session, so report it without
# blocking and let the anti-drift audit decide on actual drift.
cd "$(dirname "$0")/../.." || exit 1

if [[ -n $(git status --porcelain) ]]; then
  echo "[worktree-guard] Note: worktree has uncommitted changes."
fi

echo "[worktree-guard] Running Anti-Drift Guardian Check..."
if ! pnpm audit:antidrift -- --allow-dirty; then
  echo "[worktree-guard] ERROR: Drift detected. Agent changes violate the governing line."
  exit 1
fi

exit 0
