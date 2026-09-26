#!/usr/bin/env bash
# ==============================================================================
# Arch-CorpOS Authority Gatekeeper (CorpOS Governance)
# Evaluates requested action against department ceiling and L0-L3 matrix.
# Handles human approval card generation for Level 3 actions.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORPOS_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${CORPOS_ROOT}/corpos.config.json"
APPROVALS_DIR="${CORPOS_ROOT}/storage/approvals"

mkdir -p "${APPROVALS_DIR}"

ACTION=""
LEVEL="L1"
DEPARTMENT="engineering"
TICK_ID="tick-$(date +%s)"
REASON=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --action) ACTION="$2"; shift 2 ;;
    --level) LEVEL="$2"; shift 2 ;;
    --department) DEPARTMENT="$2"; shift 2 ;;
    --tick-id) TICK_ID="$2"; shift 2 ;;
    --reason) REASON="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "${ACTION}" ]]; then
  echo "Error: --action parameter is required" >&2
  exit 1
fi

# Map level string to numeric rank
level_to_rank() {
  case "$1" in
    L0) echo 0 ;;
    L1) echo 1 ;;
    L2) echo 2 ;;
    L3) echo 3 ;;
    *) echo 99 ;;
  esac
}

REQ_RANK=$(level_to_rank "${LEVEL}")

# Extract department ceiling from config
CEILING=$(node -e '
  const cfg = require("'"${CONFIG_FILE}"'");
  const dept = cfg.departments["'"${DEPARTMENT}"'"];
  console.log(dept ? dept.authority_ceiling : "L1");
')
CEILING_RANK=$(level_to_rank "${CEILING}")

if (( REQ_RANK > CEILING_RANK )); then
  echo "❌ [AUTHORITY DENIED]: Requested level ${LEVEL} exceeds department '${DEPARTMENT}' ceiling of ${CEILING}." >&2
  exit 2
fi

# Check if L3 requires human approval
if [[ "${LEVEL}" == "L3" ]]; then
  APPROVAL_FILE="${APPROVALS_DIR}/${TICK_ID}.md"

  # Check if already approved
  if [[ -f "${APPROVAL_FILE}" ]]; then
    if grep -q "status: APPROVED" "${APPROVAL_FILE}"; then
      echo "✅ [AUTHORITY GRANTED]: Human approval confirmed for ${TICK_ID}."
      exit 0
    fi
  fi

  # Generate approval card
  cat <<EOF > "${APPROVAL_FILE}"
---
approval_id: "${TICK_ID}"
created_at: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
department: "${DEPARTMENT}"
requested_level: "${LEVEL}"
action: "${ACTION}"
status: PENDING_APPROVAL
approved_by: null
approved_at: null
---

# Human Approval Request: ${ACTION}

## 1. Operational Context
- **Tick ID:** \`${TICK_ID}\`
- **Department:** \`${DEPARTMENT}\`
- **Authority Level:** \`${LEVEL} (Executive/Admin)\`
- **Reason:** ${REASON:-"Automated maintenance requiring elevated permissions"}

## 2. Risk Assessment
This action requires Level 3 authority (e.g. database schema mutation, secret alteration, or production configuration). Automated execution is held until verified by an authorized human operator.

## 3. Human Operator Instructions
To approve this action, run the following CLI command:
\`\`\`bash
corpos approve "${TICK_ID}"
\`\`\`
Or manually update the frontmatter of this file to:
\`\`\`yaml
status: APPROVED
approved_by: "<your-name>"
approved_at: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
\`\`\`
EOF

  echo "⏸️  [AUTHORITY HELD]: Action '${ACTION}' requires human operator approval."
  echo "📄 Approval card created: ${APPROVAL_FILE}"
  exit 10
fi

echo "✅ [AUTHORITY GRANTED]: Action '${ACTION}' (${LEVEL}) permitted for department '${DEPARTMENT}'."
exit 0
