#!/bin/bash
# scancode-toolkit (CDX) Integration for Arch-System
# License compliance, SBOM generation, and vulnerability scanning
set -euo pipefail

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${PROJECT_DIR}/documentation/03-audit-reports"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)

mkdir -p "${REPORT_DIR}"

echo "=== scancode-toolkit Scan ==="
echo "Project: ${PROJECT_DIR}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Run scancode-toolkit if available
if command -v scancode >/dev/null 2>&1; then
    echo "Running scancode-toolkit..."
    scancode "${PROJECT_DIR}" \
        --output spdx-json \
        --output-json "${REPORT_DIR}/cdx-sbom-${TIMESTAMP}.json" \
        --license-compliance \
        --cpe \
        --url \
        --verify \
        2>&1 | tee "${REPORT_DIR}/cdx-scan-log-${TIMESTAMP}.txt"

    echo ""
    echo "SBOM generated: ${REPORT_DIR}/cdx-sbom-${TIMESTAMP}.json"
    echo "License compliance report generated"
else
    echo "scancode-toolkit not found in PATH"
    echo "To install: pip3 install scancode-toolkit --break-system-packages"
    echo "Or see: https://github.com/aboutcode-org/scancode-toolkit"
fi

# Generate CycloneDX too if available
if command -v scancode >/dev/null 2>&1; then
    echo ""
    echo "Generating CycloneDX SBOM..."
    scancode "${PROJECT_DIR}" \
        --output cyclonedx-json \
        --output-json "${REPORT_DIR}/cdx-cyclonedx-${TIMESTAMP}.json" \
        2>&1 | tee "${REPORT_DIR}/cdx-cyclonedx-log-${TIMESTAMP}.txt"
    echo "CycloneDX SBOM generated"
fi

echo ""
echo "=== Scan Complete ==="