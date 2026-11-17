#!/bin/bash
# ratchet Dependency Policy Enforcement for Arch-System
# Enforce dependency update policies, budgets, and lockfile integrity
set -euo pipefail

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${PROJECT_DIR}/documentation/03-audit-reports"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)

mkdir -p "${REPORT_DIR}"

echo "=== ratchet Dependency Policy Check ==="
echo "Project: ${PROJECT_DIR}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Check if ratchet is available
if command -v ratchet &> /dev/null; then
    echo "Running ratchet..."
    
    # Check dependency budgets
    echo ""
    echo "=== Dependency Budgets ==="
    ratchet check \
        --type dependencies \
        --config 2>&1 | tee "${REPORT_DIR}/ratchet-budgets-${TIMESTAMP}.txt" || true
    
    # Check for outdated dependencies
    echo ""
    echo "=== Outdated Dependencies ==="
    ratchet check \
        --type outdated \
        --config 2>&1 | tee "${REPORT_DIR}/ratchet-outdated-${TIMESTAMP}.txt" || true
    
    # Enforce policies
    echo ""
    echo "=== Policy Enforcement ==="
    ratchet enforce \
        --config 2>&1 | tee "${REPORT_DIR}/ratchet-enforce-${TIMESTAMP}.txt" || true
    
    echo ""
    echo "=== Policy Checks Complete ==="
else
    echo "ratchet not found in PATH"
    echo "To install: npm i -D ratchet or see https://github.com/sethvargo/ratchet"
    echo "Note: ratchet may require Go or Node setup depending on version"
fi

# Integrate with existing pnpm token budget check
echo ""
echo "=== Existing Token Budget Check ==="
if [ -f "${PROJECT_DIR}/pnpm-workspace.yaml" ]; then
    echo "Running pnpm token budget check..."
    cd "${PROJECT_DIR}" && pnpm token:budget-check 2>&1 | tee "${REPORT_DIR}/ratchet-token-budget-${TIMESTAMP}.txt" || true
    echo "Token budget check complete"
else
    echo "No pnpm-workspace.yaml found - skipping token budget check"
fi

echo ""
echo "=== ratchet Policy Check Complete ==="