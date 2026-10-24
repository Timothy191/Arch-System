#!/usr/bin/env bash
set -euo pipefail

payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')
[ -n "$cmd" ] || exit 0

case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])(--no-verify|-[a-zA-Z]*n[a-zA-Z]*)([[:space:]]|$)'; then
  echo "Blocked: bypassing commit hooks (--no-verify/-n) is not allowed. Fix the failing hook instead." >&2
  exit 2
fi

if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])--no-gpg-sign([[:space:]]|$)'; then
  echo "Blocked: --no-gpg-sign is not allowed." >&2
  exit 2
fi

exit 0
