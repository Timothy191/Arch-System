#!/bin/bash
# Bundle Size Monitoring Script
# Monitors bundle sizes and prevents regressions
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_PATH="$REPO_ROOT/apps/portal/.next/static"
MAX_SIZE_MB=5

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📊 Monitoring bundle sizes..."

if [ ! -d "$BUNDLE_PATH" ]; then
  echo -e "${YELLOW}⚠️  Bundle directory not found. Run build first.${NC}"
  echo -e "${YELLOW}   Run: pnpm --filter portal build${NC}"
  exit 1
fi

# Calculate bundle size
bundle_size=$(du -sm "$BUNDLE_PATH" 2>/dev/null | cut -f1)

if [ -z "$bundle_size" ]; then
  echo -e "${RED}❌ Failed to calculate bundle size${NC}"
  exit 1
fi

echo -e "Current bundle size: ${bundle_size}MB"
echo -e "Maximum allowed: ${MAX_SIZE_MB}MB"

if [ "$bundle_size" -gt "$MAX_SIZE_MB" ]; then
  echo -e "${RED}❌ Bundle size (${bundle_size}MB) exceeds limit (${MAX_SIZE_MB}MB)${NC}"
  echo -e "${RED}   Consider lazy loading heavy components or code splitting${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Bundle size acceptable: ${bundle_size}MB${NC}"
fi

# Show breakdown by file type
echo ""
echo "📁 File type breakdown:"
echo "────────────────────────────────"
find "$BUNDLE_PATH" -type f -name "*.js" -exec du -ch {} + | grep total | sort -h | head -5
echo "────────────────────────────────"

exit 0