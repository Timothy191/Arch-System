#!/bin/bash
if [[ -n $(git status --porcelain) ]]; then
  echo "ERROR: Worktree is not clean."
  exit 1
fi
exit 0
