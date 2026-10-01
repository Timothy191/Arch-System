#!/usr/bin/env bash
set -e

# ==============================================================================
# Vercel Deployment Runner for Arch-System Monorepo
# Usage:
#   ./tools/scripts/vercel-deploy.sh           # Deploy Preview
#   ./tools/scripts/vercel-deploy.sh --prod    # Deploy Production
# ==============================================================================

MODE="preview"
DEPLOY_FLAGS="--yes"

for arg in "$@"; do
  case $arg in
    --prod|--production)
      MODE="production"
      DEPLOY_FLAGS="--prod --yes"
      shift
      ;;
    --preview)
      MODE="preview"
      DEPLOY_FLAGS="--yes"
      shift
      ;;
  esac
done

echo "========================================================"
echo "🚀 [VERCEL DEPLOY] Target Environment: ${MODE^^}"
echo "========================================================"

# Step 1: Run preflight audit
echo "🔍 Step 1: Running Vercel deployment preflight..."
node tools/scripts/vercel-preflight.cjs

# Step 2: Check project linkage
if [ ! -f ".vercel/project.json" ]; then
  echo "⚠️  No .vercel/project.json found. Linking project..."
  pnpm dlx vercel link --yes
fi

# Step 3: Trigger deployment
echo "🚀 Step 2: Triggering Vercel deployment (${DEPLOY_FLAGS})..."
pnpm dlx vercel deploy ${DEPLOY_FLAGS}

echo "========================================================"
echo "✅ [VERCEL DEPLOY] Deployment initiated successfully."
echo "========================================================"
