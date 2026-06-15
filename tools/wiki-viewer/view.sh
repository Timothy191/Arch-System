#!/usr/bin/env bash
# Wiki Viewer Launcher
# Generates a fresh viewer.html and opens it in the default browser.
# Self-contained — does not impact the main project.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HTML="${SCRIPT_DIR}/viewer.html"

echo "Generating wiki viewer..."
node "${SCRIPT_DIR}/generate.js"

echo "Opening ${HTML} ..."

# Try common openers
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${HTML}"
elif command -v open >/dev/null 2>&1; then
  open "${HTML}"
elif command -v python3 >/dev/null 2>&1; then
  python3 -m webbrowser "${HTML}"
elif command -v python >/dev/null 2>&1; then
  python -m webbrowser "${HTML}"
else
  echo "Please open ${HTML} in your browser."
fi
