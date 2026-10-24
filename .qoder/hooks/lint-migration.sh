#!/usr/bin/env bash
set -uo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_response.filePath // .tool_input.file_path // empty')

case "$file" in
  */packages/database/migrations/*.sql) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

repo="${QODER_PROJECT_DIR:-$PWD}"
case "$file" in
  "$repo"/*) rel="${file#"$repo"/}" ;;
  *) rel="$file" ;;
esac

node packages/database/scripts/lint-migrations.mjs "$rel" 2>&1 || true
exit 0
