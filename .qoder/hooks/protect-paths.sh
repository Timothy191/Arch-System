#!/usr/bin/env bash
set -euo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')
[ -n "$file" ] || exit 0

repo="${QODER_PROJECT_DIR:-$PWD}"
case "$file" in
  "$repo"/*) rel="${file#"$repo"/}" ;;
  *) rel="$file" ;;
esac
rel="${rel#./}"

# Templates are safe to edit; real env files are not.
case "$rel" in
  *.example)
    exit 0
    ;;
  *.generated.*)
    echo "Blocked: $rel is generated. Change its source and regenerate (pnpm policy:gen, pnpm version:sync, pnpm --filter @repo/database db:types) instead." >&2
    exit 2
    ;;
  .env|.env.*|*/.env|*/.env.*)
    echo "Blocked: $rel is an environment file. Never edit real .env files or commit secrets; update *.example instead." >&2
    exit 2
    ;;
  packages/supabase/migrations/*)
    echo "Blocked: packages/supabase/migrations is a symlink. Edit packages/database/migrations/ instead." >&2
    exit 2
    ;;
  config/tools/eslint.boundaries.cjs)
    echo "Blocked: config/tools/eslint.boundaries.cjs is generated. Change the policy source and run pnpm policy:gen." >&2
    exit 2
    ;;
esac

exit 0
