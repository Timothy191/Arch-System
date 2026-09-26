#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# Arch-Systems — Global Asset Synchronizer
# Syncs global assets from the root assets/ directory to
# workspace public folders at dev/build time.
# Performs clean sync: removes existing asset dirs before copying.
# ──────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Define target public directories dynamically to ensure workspace-wide sync
# Check all potential public directories in apps/ and packages/
TARGETS=()
for app_public in "$REPO_ROOT"/apps/*/public; do
  if [ -d "$app_public" ]; then
    TARGETS+=("${app_public#"$REPO_ROOT/"}")
  fi
done

for pkg_public in "$REPO_ROOT"/packages/*/public; do
  if [ -d "$pkg_public" ]; then
    TARGETS+=("${pkg_public#"$REPO_ROOT/"}")
  fi
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=("apps/portal/public")
fi

# Asset subdirectories to sync (these will be removed and recreated)
ASSET_DIRS=("fonts" "media" "static")

echo "  → Synchronizing global assets from assets/..."

if [ ! -d "$REPO_ROOT/assets" ]; then
  echo "  ✗ Error: assets/ directory not found."
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
  cp -R "$REPO_ROOT/assets/." "$FULL_TARGET/"
  
  echo "  ✓ Successfully synced assets to $TARGET"
done

echo "  ✓ Asset synchronization complete!"
echo "  → Root assets/ at $REPO_ROOT/assets is now the single source of truth"
