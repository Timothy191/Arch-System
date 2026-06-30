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
    [ -d "$ROOT/01_platform_packages/$pkg" ] && link_pkg "$nm/@repo" "$pkg" "$up/01_platform_packages/$pkg"
  done
  for layer in ui data-access utils; do
    [ -d "$ROOT/02_domain_libraries/features/auth/$layer" ] && link_pkg "$nm/@repo/auth" "$layer" "$up/02_domain_libraries/features/auth/$layer"
  done
  [ -d "$ROOT/02_domain_libraries/features/departments/ui" ] && link_pkg "$nm/@repo/departments" "ui" "$up/02_domain_libraries/features/departments/ui"
  [ -d "$ROOT/02_domain_libraries/features/hub/ui" ] && link_pkg "$nm/@repo/hub" "ui" "$up/02_domain_libraries/features/hub/ui"
  [ -d "$ROOT/02_domain_libraries/features/dashboard/data-access" ] && link_pkg "$nm/@repo/dashboard" "data-access" "$up/02_domain_libraries/features/dashboard/data-access"
  for pkg in data-access hooks utils; do
    [ -d "$ROOT/02_domain_libraries/shared/$pkg" ] && link_pkg "$nm/@repo/shared" "$pkg" "$up/02_domain_libraries/shared/$pkg"
  done
}

repair_at "$ROOT/node_modules"
repair_at "$ROOT/00_applications/portal/node_modules"
repair_at "$ROOT/02_domain_libraries/shared/data-access/node_modules"
repair_at "$ROOT/02_domain_libraries/shared/utils/node_modules"
repair_at "$ROOT/02_domain_libraries/features/departments/ui/node_modules"

echo "workspace symlinks repaired"
