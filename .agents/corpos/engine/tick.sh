#!/usr/bin/env bash
# ==============================================================================
# Arch-CorpOS Win Loop Execution Engine (tick.sh)
# Synthesizes win.sh (signal -> brief -> act -> verify -> journal -> schedule),
# CorpOS (governance & L0-L3 gates), and ai-company (tiered departments).
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORPOS_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${CORPOS_ROOT}/corpos.config.json"
STORAGE_DIR="${CORPOS_ROOT}/storage"
JOURNAL_FILE="${STORAGE_DIR}/journal.jsonl"

LOOP_ID=""
DRY_RUN=false
SIGNAL_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --signal) SIGNAL_OVERRIDE="$2"; shift 2 ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *)
      if [[ -z "${LOOP_ID}" ]]; then
        LOOP_ID="$1"
      fi
      shift
      ;;
  esac
done

if [[ -z "${LOOP_ID}" ]]; then
  echo "Usage: tick.sh <loop-id> [--dry-run] [--signal '<payload>']" >&2
  exit 1
fi

LOOP_DIR="${CORPOS_ROOT}/loops/${LOOP_ID}"
if [[ ! -d "${LOOP_DIR}" ]]; then
  echo "Error: Loop directory '${LOOP_DIR}' does not exist." >&2
  exit 1
fi

LOOP_SPEC="${LOOP_DIR}/LOOP.md"
LOOP_SKILL="${LOOP_DIR}/SKILL.md"

if [[ ! -f "${LOOP_SPEC}" ]]; then
  echo "Error: ${LOOP_SPEC} not found." >&2
  exit 1
fi

# ------------------------------------------------------------------------------
# 1. Parse Loop Metadata
# ------------------------------------------------------------------------------
DEPARTMENT=$(node -e '
  const fs = require("fs");
  const content = fs.readFileSync("'"${LOOP_SPEC}"'", "utf8");
  const match = content.match(/department:\s*["\x27]?([^\r\n"\x27]+)/);
  console.log(match ? match[1].trim() : "engineering");
')

AUTHORITY_LEVEL=$(node -e '
  const fs = require("fs");
  const content = fs.readFileSync("'"${LOOP_SPEC}"'", "utf8");
  const match = content.match(/authority_level:\s*["\x27]?([^\r\n"\x27]+)/);
  console.log(match ? match[1].trim() : "L1");
')

TICK_ID="tick-$(date +%Y%m%d-%H%M%S)-${LOOP_ID}"
TICK_TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "======================================================================"
echo "🚀 [ARCH-CORPOS WIN LOOP TICK]: ${TICK_ID}"
echo "🏢 Department: ${DEPARTMENT} | 🛡️  Authority: ${AUTHORITY_LEVEL}"
echo "======================================================================"

# ------------------------------------------------------------------------------
# 2. Signal Intake & Evaluation
# ------------------------------------------------------------------------------
SIGNAL="${SIGNAL_OVERRIDE:-"periodic_scheduled_tick"}"
echo "📡 Ingested Signal: ${SIGNAL}"

# ------------------------------------------------------------------------------
# 3. Generate Brief (storage/briefs/<tick_id>.md)
# ------------------------------------------------------------------------------
BRIEF_FILE="${STORAGE_DIR}/briefs/${TICK_ID}.md"
cat <<EOF > "${BRIEF_FILE}"
---
tick_id: "${TICK_ID}"
loop_id: "${LOOP_ID}"
department: "${DEPARTMENT}"
authority_level: "${AUTHORITY_LEVEL}"
created_at: "${TICK_TIMESTAMP}"
signal: "${SIGNAL}"
dry_run: ${DRY_RUN}
---

# Operational Brief: ${LOOP_ID}

## 1. Context & Ingested Signal
- **Loop:** \`${LOOP_ID}\`
- **Department:** \`${DEPARTMENT}\`
- **Signal:** \`${SIGNAL}\`
- **Authority Requested:** \`${AUTHORITY_LEVEL}\`

## 2. Hypothesis & Purpose
Evaluate current health and drift within the \`${DEPARTMENT}\` domain. Ensure adherence to corporate quality gates and system safety policies.

## 3. Operational Plan
1. Ingest telemetry and workspace state.
2. Verify policy assertions and test suites.
3. Capture evidence artifacts in \`.agents/corpos/storage/artifacts/${TICK_ID}/\`.
4. Re-calculate adaptive scheduling interval.
EOF

echo "📄 Generated Strategic Brief: ${BRIEF_FILE}"

# ------------------------------------------------------------------------------
# 4. Authority Gatekeeper Check (CorpOS)
# ------------------------------------------------------------------------------
echo "🛡️  Checking Authority Gatekeeper..."
AUTH_EXIT=0
"${SCRIPT_DIR}/authority.sh" \
  --action "Execute business loop '${LOOP_ID}'" \
  --level "${AUTHORITY_LEVEL}" \
  --department "${DEPARTMENT}" \
  --tick-id "${TICK_ID}" \
  --reason "Automated business loop execution triggered by signal: ${SIGNAL}" || AUTH_EXIT=$?

if [[ ${AUTH_EXIT} -eq 10 ]]; then
  echo "⏸️  Loop tick paused pending human operator sign-off."
  STATUS="PENDING_APPROVAL"
elif [[ ${AUTH_EXIT} -ne 0 ]]; then
  echo "❌ Loop tick blocked by authority gatekeeper."
  STATUS="BLOCKED"
else
  STATUS="PENDING_EXECUTION"
fi

ARTIFACTS_DIR="${STORAGE_DIR}/artifacts/${TICK_ID}"
mkdir -p "${ARTIFACTS_DIR}"

VERIFICATION_LOGS=()
OVERALL_SUCCESS=true

# ------------------------------------------------------------------------------
# 5. Worktree Sandboxing & Verification Execution
# ------------------------------------------------------------------------------
if [[ "${STATUS}" == "PENDING_EXECUTION" ]]; then
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "🔍 [DRY RUN]: Simulating verification checks without modifying workspace."
    STATUS="SUCCESS"
  else
    echo "⚙️  Executing Verification Gates from LOOP.md..."
    
    # Extract verification commands
    VERIF_CMDS=$(node -e '
      const fs = require("fs");
      const content = fs.readFileSync("'"${LOOP_SPEC}"'", "utf8");
      const verifSection = content.split("verification:")[1] || "";
      const lines = verifSection.split("\n");
      const cmds = [];
      for (const line of lines) {
        const m = line.match(/^\s*-\s*["\x27]?([^"\x27\r\n]+)["\x27]?/);
        if (m) cmds.push(m[1].trim());
      }
      console.log(cmds.join(";;;"));
    ')

    IFS=";;;" read -ra CMDS <<< "${VERIF_CMDS}"
    for cmd in "${CMDS[@]}"; do
      if [[ -n "${cmd}" ]]; then
        echo "   ▶️ Running: ${cmd}"
        CMD_LOG="${ARTIFACTS_DIR}/cmd_$(date +%s).log"
        if eval "${cmd}" > "${CMD_LOG}" 2>&1; then
          echo "      ✅ PASS"
          VERIFICATION_LOGS+=("{\"command\": \"${cmd}\", \"status\": \"PASS\"}")
        else
          echo "      ❌ FAIL (see ${CMD_LOG})"
          VERIFICATION_LOGS+=("{\"command\": \"${cmd}\", \"status\": \"FAIL\"}")
          OVERALL_SUCCESS=false
        fi
      fi
    done

    if [[ "${OVERALL_SUCCESS}" == "true" ]]; then
      STATUS="SUCCESS"
    else
      STATUS="FAILED"
    fi
  fi
fi

# ------------------------------------------------------------------------------
# 6. Capture Outcome & Evidence (storage/outcomes/<tick_id>.md)
# ------------------------------------------------------------------------------
OUTCOME_FILE="${STORAGE_DIR}/outcomes/${TICK_ID}.md"
cat <<EOF > "${OUTCOME_FILE}"
---
tick_id: "${TICK_ID}"
loop_id: "${LOOP_ID}"
department: "${DEPARTMENT}"
final_status: "${STATUS}"
timestamp: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
---

# Operational Outcome: ${LOOP_ID}

## Summary
- **Tick ID:** \`${TICK_ID}\`
- **Result:** \`${STATUS}\`
- **Evidence Path:** \`${ARTIFACTS_DIR}\`
- **Brief Reference:** \`${BRIEF_FILE}\`

## Verification Assessment
$(if [[ ${#VERIFICATION_LOGS[@]} -gt 0 ]]; then
  echo "Commands executed:"
  for entry in "${VERIFICATION_LOGS[@]}"; do
    echo "- \`${entry}\`"
  done
else
  echo "No active verification commands run (dry run or paused state)."
fi)
EOF

echo "📊 Outcome Recorded: ${OUTCOME_FILE}"

# ------------------------------------------------------------------------------
# 7. Adaptive Rescheduling (Win Pattern)
# ------------------------------------------------------------------------------
SCHED_OUTPUT=$("${SCRIPT_DIR}/scheduler.sh" --loop-id "${LOOP_ID}" --last-status "${STATUS}")
NEXT_RUN=$(node -e 'console.log(JSON.parse(process.argv[1]).next_run_iso);' "${SCHED_OUTPUT}")
NEXT_INTERVAL=$(node -e 'console.log(JSON.parse(process.argv[1]).next_interval_minutes);' "${SCHED_OUTPUT}")

echo "⏰ Next Scheduled Run in ${NEXT_INTERVAL}m: ${NEXT_RUN}"

# ------------------------------------------------------------------------------
# 8. Append to Audit Journal (storage/journal.jsonl)
# ------------------------------------------------------------------------------
JOURNAL_ENTRY=$(node -e '
  const entry = {
    tick_id: "'"${TICK_ID}"'",
    timestamp: "'"${TICK_TIMESTAMP}"'",
    loop_id: "'"${LOOP_ID}"'",
    department: "'"${DEPARTMENT}"'",
    authority_level: "'"${AUTHORITY_LEVEL}"'",
    signal: "'"${SIGNAL}"'",
    status: "'"${STATUS}"'",
    brief_file: "'"${BRIEF_FILE}"'",
    outcome_file: "'"${OUTCOME_FILE}"'",
    next_scheduled_run: "'"${NEXT_RUN}"'"
  };
  console.log(JSON.stringify(entry));
')

echo "${JOURNAL_ENTRY}" >> "${JOURNAL_FILE}"
echo "📓 Journal Appended: ${JOURNAL_FILE}"
echo "🏁 [TICK COMPLETED]: Status = ${STATUS}"
exit 0
