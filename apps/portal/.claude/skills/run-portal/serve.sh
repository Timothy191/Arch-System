#!/usr/bin/env bash
# Launch the portal dev server under pm2 on :3000 (the agent path).
# Bridges SUPABASE_SERVICE_ROLE_KEY from .env's SUPABASE_SERVICE_KEY —
# see the "supabaseKey is required" gotcha in SKILL.md.
set -euo pipefail
PORTAL_DIR="$(cd "$(dirname "$0")/../../.." && pwd)" # apps/portal
cd "$PORTAL_DIR"
if [ -f .env ]; then
  role_key="$(rg '^SUPABASE_SERVICE_KEY=' .env | head -1 | cut -d= -f2-)"
  [ -n "$role_key" ] && export SUPABASE_SERVICE_ROLE_KEY="$role_key"
fi
exec pm2 start pnpm --name portal-dev --cwd "$PORTAL_DIR" -- dev
