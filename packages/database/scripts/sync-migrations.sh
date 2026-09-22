#!/bin/bash
set -e

# Find repo root
ROOT_DIR=$(git rev-parse --show-toplevel)
SOURCE_DIR="$ROOT_DIR/packages/database/migrations"
TARGET_DIR="$ROOT_DIR/packages/supabase/migrations"

if [ "$1" == "--check" ]; then
  if diff -r -q "$SOURCE_DIR" "$TARGET_DIR" > /dev/null; then
    echo "Migrations are in sync."
    exit 0
  else
    echo "Error: Migrations drift detected between $SOURCE_DIR and $TARGET_DIR."
    echo "Run 'pnpm --filter @repo/database sync-migrations' to fix."
    exit 1
  fi
else
  echo "Syncing migrations from $SOURCE_DIR to $TARGET_DIR..."
  rm -rf "$TARGET_DIR"
  cp -r "$SOURCE_DIR" "$TARGET_DIR"
  echo "Done."
fi
