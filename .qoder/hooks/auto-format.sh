#!/usr/bin/env bash
set -euo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_response.filePath // .tool_input.file_path // empty')

[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css) ;;
  *) exit 0 ;;
esac

case "$file" in
  */node_modules/*|*/.next/*|*/dist/*|*/coverage/*) exit 0 ;;
esac

# `check` (not `format`) so nursery.useSortedClasses safe-fixes apply: the
# canonical class order is a linter rule, invisible to `biome format`.
./node_modules/.bin/biome check --write "$file" >/dev/null 2>&1 || true
exit 0
