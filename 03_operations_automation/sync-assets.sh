#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# Arch-Systems — Global Asset Synchronizer
# Syncs global assets from the root 04_shared_static_assets/ directory to
# workspace public folders at dev/build time.
# Performs clean sync: removes existing asset dirs before copying.
# ──────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Define target public directories
TARGETS=(
  "00_applications/portal/public"
)

# Asset subdirectories to sync (these will be removed and recreated)
ASSET_DIRS=("background" "error-pages" "icons" "images" "large")

echo "  → Synchronizing global assets from root 04_shared_static_assets/..."

if [ ! -d "$REPO_ROOT/04_shared_static_assets" ]; then
  echo "  ✗ Error: 04_shared_static_assets/ directory not found."
  exit 1
fi

for TARGET in "${TARGETS[@]}"; do
  FULL_TARGET="$REPO_ROOT/$TARGET"
  echo "  → Syncing to $TARGET..."
  
  # Ensure the target directory exists
  mkdir -p "$FULL_TARGET"
  
  # Remove existing asset directories for clean sync
  for DIR in "${ASSET_DIRS[@]}"; do
    if [ -d "$FULL_TARGET/$DIR" ]; then
      echo "    → Removing existing $DIR/"
      rm -rf "$FULL_TARGET/$DIR"
    fi
  done
  
  # Copy files while preserving directory structure
  # Using cp -R ensures spaces in names (like "light mode.mp4") are handled properly
  cp -R "$REPO_ROOT/04_shared_static_assets/." "$FULL_TARGET/"
  
  echo "  ✓ Successfully synced assets to $TARGET"
done

echo "  ✓ Asset synchronization complete!"
echo "  → Root 04_shared_static_assets/ at $REPO_ROOT/04_shared_static_assets is now the single source of truth"
