#!/usr/bin/env bash
# Repair @repo symlinks after root directory renumber.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

link_pkg() {
  local nm_dir="$1" name="$2" target="$3"
  mkdir -p "$(dirname "$nm_dir/$name")"
  rm -f "$nm_dir/$name"
  ln -sf "$target" "$nm_dir/$name"
}

repair_at() {
  local nm="$1"
  [ -d "$nm/@repo" ] || return 0
  local up
  up="$(node -e "const p=require('path');const r='$ROOT';const n=p.join('$nm','@repo');console.log(p.relative(n,r).split(p.sep).map(()=>'..').join('/')||'.')")"

  for pkg in contract errors logger rate-limiter redis supabase theme typescript-config ui utils; do
    [ -d "$ROOT/pkgs/$pkg" ] && link_pkg "$nm/@repo" "$pkg" "$up/pkgs/$pkg"
  done
  for layer in ui data-access utils; do
    [ -d "$ROOT/libs/features/auth/$layer" ] && link_pkg "$nm/@repo/auth" "$layer" "$up/libs/features/auth/$layer"
  done
  [ -d "$ROOT/libs/features/departments/ui" ] && link_pkg "$nm/@repo/departments" "ui" "$up/libs/features/departments/ui"
  [ -d "$ROOT/libs/features/hub/ui" ] && link_pkg "$nm/@repo/hub" "ui" "$up/libs/features/hub/ui"
  [ -d "$ROOT/libs/features/dashboard/data-access" ] && link_pkg "$nm/@repo/dashboard" "data-access" "$up/libs/features/dashboard/data-access"
  for pkg in data-access hooks utils; do
    [ -d "$ROOT/libs/shared/$pkg" ] && link_pkg "$nm/@repo/shared" "$pkg" "$up/libs/shared/$pkg"
  done
}

repair_at "$ROOT/node_modules"
repair_at "$ROOT/apps/portal/node_modules"
repair_at "$ROOT/libs/shared/data-access/node_modules"
repair_at "$ROOT/libs/shared/utils/node_modules"
repair_at "$ROOT/libs/features/departments/ui/node_modules"

echo "workspace symlinks repaired"
