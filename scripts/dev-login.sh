#!/usr/bin/env bash
set -euo pipefail

# Minimal dev script to start portal and open login page
# Uses the existing dev.sh with --quick flag to skip Docker/Supabase
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Check if node_modules exists
if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo "✗ node_modules not found. Run 'pnpm install' first."
  exit 1
fi

# Check if .env exists
if [ ! -f "$REPO_ROOT/apps/portal/.env" ]; then
  echo "⚠ .env not found. Copying from env/.env.example..."
  cp "$REPO_ROOT/apps/portal/env/.env.example" "$REPO_ROOT/apps/portal/.env"
fi

# Set resource limits to prevent system freeze
export NODE_OPTIONS="--max-old-space-size=2048"

# Run the existing dev script in quick mode (skips Docker/Supabase)
bash "$REPO_ROOT/scripts/dev.sh" --quick
