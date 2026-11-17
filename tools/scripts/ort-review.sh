#!/bin/bash
# oss-review-toolkit (ORT) Integration for Arch-System
# Comprehensive OSS compliance, vulnerability scanning, and SBOM generation
set -euo pipefail

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${PROJECT_DIR}/documentation/03-audit-reports"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)

mkdir -p "${REPORT_DIR}"

echo "=== oss-review-toolkit Review ==="
echo "Project: ${PROJECT_DIR}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Run ort if available
if command -v ort &> /dev/null; then
    echo "Running oss-review-toolkit..."
    ort scan \
        --path "${PROJECT_DIR}" \
        --output "${REPORT_DIR}/ort-scan-${TIMESTAMP}" \
        --format sarif json \
        2>&1 | tee "${REPORT_DIR}/ort-scan-log-${TIMESTAMP}.txt"

    echo ""
    echo "Scan report: ${REPORT_DIR}/ort-scan-${TIMESTAMP}.sarif.json"
    echo "Full results in report directory"
else
    echo "ort not found in PATH"
    echo "To install: pip3 install aboutcode-toolkit --break-system-packages"
    echo "Or see: https://github.com/oss-review-toolkit/ort"
fi

# Generate SPDX SBOM if scancode is available
if command -v scancode >/dev/null 2>&1; then
    echo ""
    echo "Generating SPDX SBOM via scancode..."
    scancode "${PROJECT_DIR}" \
        --output spdx-json \
        --output-json "${REPORT_DIR}/ort-spdx-${TIMESTAMP}.json" \
        --license-compliance \
        2>&1 | tee "${REPORT_DIR}/ort-spdx-log-${TIMESTAMP}.txt"
    echo "SPDX SBOM generated: ${REPORT_DIR}/ort-spdx-${TIMESTAMP}.json"
fi

echo ""
echo "=== Review Complete ==="