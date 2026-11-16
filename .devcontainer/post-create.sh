#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required_node_major=24
node_major="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [[ "$node_major" -lt "$required_node_major" ]]; then
  printf 'Node.js >= %s is required; found %s.\n' "$required_node_major" "$(node --version)" >&2
  exit 1
fi

if [[ "$(pnpm --version 2>/dev/null || true)" != "9.15.9" ]]; then
  npm install --global pnpm@9.15.9
fi

if ! command -v rustup >/dev/null 2>&1; then
  printf 'rustup is required by the Arch-System Rust toolchain feature.\n' >&2
  exit 1
fi

rustup toolchain install 1.85.0 --profile minimal --component rustfmt --component clippy

printf '\nToolchain versions:\n'
node --version
pnpm --version
rustc +1.85.0 --version
cargo +1.85.0 --version

printf '\nInstalling the workspace from the committed lockfile...\n'
pnpm install --frozen-lockfile

printf '\nArch-System Codespaces bootstrap completed.\n'
printf 'No application, database, or deployment services were started.\n'
