#!/usr/bin/env bash
# ==============================================================================
# Arch-System (Plantcor OS) — Kilo Autonomous Code Review Runner
# ==============================================================================
# Usage:
#   pnpm review                     # Review uncommitted changes (staged + unstaged + untracked)
#   pnpm review uncommitted [args]  # Review uncommitted changes with custom guidance
#   pnpm review staged [args]       # Review staged changes only
#   pnpm review branch [base] [args]# Review current branch vs base
#   pnpm review worktree [args]     # Review Agent Manager worktree changes
#   pnpm review <commit-hash>       # Review a specific commit
#   pnpm review <pr-number-or-url>  # Review a GitHub pull request
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Verify kilo CLI availability
KILO_BIN="${KILO_BIN:-$(which kilo 2>/dev/null || echo "$HOME/.local/bin/kilo")}"
if [ ! -x "$KILO_BIN" ]; then
  if [ -x "$HOME/.local/share/mise/installs/node/26.8.1/bin/kilo" ]; then
    KILO_BIN="$HOME/.local/share/mise/installs/node/26.8.1/bin/kilo"
  else
    echo "❌ Error: kilo CLI not found. Please ensure kilo is installed." >&2
    exit 1
  fi
fi

# Ensure REVIEW.md exists
if [ ! -f "$REPO_ROOT/REVIEW.md" ]; then
  echo "⚠️ Warning: REVIEW.md not found in $REPO_ROOT. Using built-in review guidance." >&2
fi

# Construct review argument string
if [ $# -eq 0 ]; then
  REVIEW_ARGS="/review"
else
  REVIEW_ARGS="/review $*"
fi

echo "🔍 [Kilo Code Review] Running: $REVIEW_ARGS in $REPO_ROOT"
cd "$REPO_ROOT"
"$KILO_BIN" run "$REVIEW_ARGS"
