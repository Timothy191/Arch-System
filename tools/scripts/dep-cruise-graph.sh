#!/bin/bash
# dependency-cruiser Graph Integration for Arch-System
# Circular dependency detection and import graph analysis
set -euo pipefail

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${PROJECT_DIR}/documentation/03-audit-reports"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)

mkdir -p "${REPORT_DIR}"

echo "=== dependency-cruiser Dependency Analysis ==="
echo "Project: ${PROJECT_DIR}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Check if dependency-cruiser is available
if command -v dep-cruise >/dev/null 2>&1; then
    echo "Running dependency-cruiser..."
    
    # Detect circular dependencies
    echo ""
    echo "=== Circular Dependencies ==="
    dep-cruise "${PROJECT_DIR}" \
        --base "." \
        --config \
        2>&1 | tee "${REPORT_DIR}/dep-cruise-circular-${TIMESTAMP}.txt" || true
    
    # Export dependency graph as DOT
    echo ""
    echo "=== Dependency Graph (DOT) ==="
    dep-cruise "${PROJECT_DIR}" \
        --base "." \
        --output dot \
        > "${REPORT_DIR}/dep-cruise-graph-${TIMESTAMP}.dot" 2>&1
    
    # Convert to PNG if graphviz is available
    if command -v dot >/dev/null 2>&1; then
        echo "Converting to PNG..."
        dot -Tpng "${REPORT_DIR}/dep-cruise-graph-${TIMESTAMP}.dot" -o "${REPORT_DIR}/dep-cruise-graph-${TIMESTAMP}.png" 2>&1
        echo "Graph saved: ${REPORT_DIR}/dep-cruise-graph-${TIMESTAMP}.png"
    else
        echo "graphviz not available - DOT file saved"
        echo "Install graphviz or use: dep-cruise --output dot"
    fi
    
    # Export as JSON for tooling
    echo ""
    echo "=== Dependency Graph (JSON) ==="
    dep-cruise "${PROJECT_DIR}" \
        --base "." \
        --output json \
        > "${REPORT_DIR}/dep-cruise-graph-${TIMESTAMP}.json" 2>&1
    echo "JSON graph saved"
    
    echo ""
    echo "=== Analysis Complete ==="
else
    echo "dependency-cruiser not found in PATH"
    echo "To install: pnpm add -D dependency-cruiser"
    echo "Or see: https://github.com/sverweij/dependency-cruiser"
fi