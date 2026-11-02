#!/usr/bin/env bash
# reviewdog-runner.sh
# Automated diff-aware code review runner using reviewdog CLI.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BIN_DIR="${ROOT_DIR}/tools/bin"
REVIEWDOG="${BIN_DIR}/reviewdog"

# Ensure reviewdog binary is available
if ! command -v reviewdog &> /dev/null; then
  if [[ ! -x "${REVIEWDOG}" ]]; then
    echo "🐶 [reviewdog] Downloading portable reviewdog binary into tools/bin..."
    mkdir -p "${BIN_DIR}"
    curl -sfL https://raw.githubusercontent.com/reviewdog/reviewdog/master/install.sh | sh -s -- -b "${BIN_DIR}"
  fi
  REVIEWDOG_CMD="${REVIEWDOG}"
else
  REVIEWDOG_CMD="reviewdog"
fi

DIFF_BASE="${1:-origin/main}"
REPORTER="${2:-local}"

echo "🐶 [reviewdog] Running diff-aware review against '${DIFF_BASE}' (reporter: ${REPORTER})..."

# Check if there are any git diffs
if git diff --quiet "${DIFF_BASE}" 2>/dev/null; then
  echo "ℹ️  No changes detected against ${DIFF_BASE}. Workspace is clean."
  exit 0
fi

# Run Biome check and pipe into reviewdog
echo "🔍 [reviewdog] Auditing Biome lint/format on changed lines..."
pnpm exec biome check --reporter=summary . 2>&1 | "${REVIEWDOG_CMD}" \
  -efm="%f:%l:%c %m" \
  -diff="git diff ${DIFF_BASE}" \
  -reporter="${REPORTER}" \
  -level=error || true

echo "✅ [reviewdog] Review completed successfully."
