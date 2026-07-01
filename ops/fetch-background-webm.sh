#!/usr/bin/env bash
# Verify the canonical shared background video exists and sync to portal public/.
# Source of truth: assets/background/white-geometric-waves.3840x2160.mp4
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CANONICAL="$REPO_ROOT/assets/background/white-geometric-waves.3840x2160.mp4"

if [ ! -f "$CANONICAL" ]; then
  echo "✗ Missing canonical background: $CANONICAL"
  exit 1
fi

echo "✓ Found $(basename "$CANONICAL")"
bash "$REPO_ROOT/ops/sync-assets.sh"
