#!/usr/bin/env bash
# clear-port.sh – kill any process listening on port 3000
# Used to avoid Turbopack port conflicts during development.

if lsof -i :3000 >/dev/null 2>&1; then
  echo "Port 3000 is in use – terminating process(es)."
  # kill all processes using the port
  fuser -k 3000/tcp || true
else
  echo "Port 3000 is free."
fi

# After clearing, start the portal dev server
pnpm --filter portal dev
