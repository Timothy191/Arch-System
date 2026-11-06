#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Real-world verification: type-check ==="
pnpm type-check

echo "=== Real-world verification: lint ==="
pnpm lint

echo "=== Real-world verification: unit tests (hub ui) ==="
pnpm --filter @repo/hub/ui test

echo "=== Real-world verification: E2E critical journeys (auth, navigation, data entry) ==="
# Requires seeded Supabase auth user and network access.
pnpm exec playwright test --config=e2e/playwright.config.ts \
  e2e/authenticated-flows.spec.ts \
  e2e/department-navigation.spec.ts \
  e2e/data-entry.spec.ts \
  --project=chromium

echo "=== All real-world verification gates passed ==="
