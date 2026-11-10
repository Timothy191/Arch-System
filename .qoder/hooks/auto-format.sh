#!/usr/bin/env bash
set -euo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_response.filePath // .tool_input.file_path // empty')

[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

case "$file" in
  */node_modules/*|*/.next/*|*/dist/*|*/coverage/*) exit 0 ;;
esac

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css)
    # `check` (not `format`) so nursery.useSortedClasses safe-fixes apply: the
    # canonical class order is a linter rule, invisible to `biome format`.
    ./node_modules/.bin/biome check --write "$file" >/dev/null 2>&1 || true
    ;;
  *.md)
    ./node_modules/.bin/markdownlint --config config/tools/.markdownlint.json --fix "$file" >/dev/null 2>&1 || true
    ./node_modules/.bin/prettier --write "$file" >/dev/null 2>&1 || true
    ;;
esac

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.cjs|*.mjs|*.md)
    ./node_modules/.bin/cspell "$file" --config config/tools/cspell.json --no-progress --gitignore --no-must-find-files >/dev/null 2>&1 || true
    ;;
esac
exit 0
