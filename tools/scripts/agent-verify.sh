#!/bin/bash
# Autonomous Agent Real-World Verification Gate (27-Gate Enterprise Suite)
# Preserves the foundational 15 static/architectural gates and expands with
# Gates 16-27 covering authorization matrices, database migration integrity,
# performance/load budgets, E2E user journeys, supply-chain security,
# observability/resilience, deployment preflight, accessibility, evidence
# integrity (JSON + JUnit), and AI agent governance/hallucination controls.

set -uo pipefail

EVIDENCE_DIR=".ci-local"
EVIDENCE_JSON="${EVIDENCE_DIR}/agent-verify-evidence.json"
TMP_GATES_NDJSON="${EVIDENCE_DIR}/.gates-run-$$.ndjson"
mkdir -p "${EVIDENCE_DIR}"
rm -f "${TMP_GATES_NDJSON}"

RUN_ID="verify_$(date -u +%Y%m%dT%H%M%SZ)"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

run_gate() {
  local id="$1"
  local icon="$2"
  local name="$3"
  local cmd="$4"
  local directive="$5"
  local policy="${6:-mandatory}"

  echo -n "${icon} ${id}. ${name}... "
  local start_ms
  start_ms=$(date +%s%3N)

  local tmp_out
  tmp_out=$(mktemp)

  if eval "${cmd}" > "${tmp_out}" 2>&1; then
    local end_ms
    end_ms=$(date +%s%3N)
    local duration_ms=$((end_ms - start_ms))
    local sha256
    sha256=$(sha256sum "${tmp_out}" | awk '{print $1}')
    rm -f "${tmp_out}"
    echo "✅ PASS (${duration_ms}ms)"
    local safe_cmd="${cmd//\"/\\\"}"
    printf '{"id":%d,"name":"%s","command":"%s","policy":"%s","status":"PASS","exitCode":0,"durationMs":%d,"outputSha256":"%s"}\n' \
      "${id}" "${name}" "${safe_cmd}" "${policy}" "${duration_ms}" "${sha256}" >> "${TMP_GATES_NDJSON}"
  else
    local exit_code=$?
    local end_ms
    end_ms=$(date +%s%3N)
    local duration_ms=$((end_ms - start_ms))
    local sha256
    sha256=$(sha256sum "${tmp_out}" | awk '{print $1}')
    echo "❌ FAIL (exit ${exit_code})"
    echo "AGENT DIRECTIVE: ${directive}"
    tail -n 25 "${tmp_out}" || true
    rm -f "${tmp_out}"
    local safe_cmd="${cmd//\"/\\\"}"
    printf '{"id":%d,"name":"%s","command":"%s","policy":"%s","status":"FAIL","exitCode":%d,"durationMs":%d,"outputSha256":"%s"}\n' \
      "${id}" "${name}" "${safe_cmd}" "${policy}" "${exit_code}" "${duration_ms}" "${sha256}" >> "${TMP_GATES_NDJSON}"
    exit 1
  fi
}

echo "========================================================"
echo "🔍 [AGENT VERIFICATION] Starting 27-Gate Quality & Runtime Suite..."
echo "========================================================"

# ── Stage 1: Foundational Static, Boundary & Architecture Gates (1–15) ────────
run_gate 1  "⚙️ " "Type Checking" \
  "pnpm type-check" \
  "Fix TypeScript errors."

run_gate 2  "🧹" "Linting & Formatting" \
  "pnpm lint" \
  "Fix Biome/ESLint errors."

run_gate 3  "🧪" "Unit Tests" \
  "pnpm test" \
  "Fix failing unit tests."

run_gate 4  "🛡️ " "Architectural Boundaries" \
  "pnpm policy:check" \
  "Fix cross-domain imports."

run_gate 5  "📊" "Contract Drift Audit" \
  "pnpm audit:drift" \
  "Align Zod types with DB."

run_gate 6  "🛡️ " "Agent Skill Security (SkillSpector)" \
  "bash tools/audits/skill-spector.sh" \
  "Security vulnerability in .agents/skills."

run_gate 7  "🤖" "MCP Server Registration & Toolchain" \
  "pnpm mcp:verify" \
  "Run 'pnpm mcp:onboard' to register required MCP servers."

run_gate 8  "💰" "Context Budget Enforcement" \
  "pnpm token:budget-check" \
  "Run 'pnpm context:debloat' to prune context bloat."

run_gate 9  "📜" "Agent Rule Drift (workspace ↔ project)" \
  "node tools/audits/audit-agent-rules-drift.cjs" \
  "Run 'node tools/audits/audit-agent-rules-drift.cjs' and sync the diverged rule to BOTH .agents/rules/ trees."

run_gate 10 "🗺️ " "Architecture Maps Parity" \
  "node tools/repo/generate-codebase-maps.cjs --check" \
  "Run 'pnpm maps:sync' or 'pnpm maps:gen' to refresh codebase-maps."

run_gate 11 "🔐" "Security Headers & Client Hooks" \
  "pnpm audit:hooks" \
  "Fix security-related hooks and clients."

run_gate 12 "📦" "Dependency License & Version Sync" \
  "pnpm deps:lint" \
  "Fix dependency license or version mismatch issues."

run_gate 13 "🔄" "Circular Dependencies" \
  "pnpm cycles" \
  "Run 'pnpm cycles' and break the reported import cycle (dependency inversion or extract shared code)."

run_gate 14 "🎨" "Tailwind Utility Composition" \
  "pnpm audit:tailwind" \
  "Run 'pnpm audit:tailwind' and combine repeated utility chains into a component, CVA variant, or cn() constant."

run_gate 15 "✂️ " "Dead Code & Unresolved Imports (Knip)" \
  "pnpm knip" \
  "Run 'pnpm knip' and remove dead files/unresolved imports."

# ── Stage 2: Security, Database, Performance, E2E & Resilience Gates (16–23) ─
run_gate 16 "🔒" "Security & Module Authorization Matrix" \
  "node tools/audits/audit-authorization-matrix.cjs --static-only && node tools/audits/audit-rls-matrix.cjs" \
  "Run 'pnpm audit:auth-matrix' and fix missing route/action auth guards or RLS policies."

run_gate 17 "🗄️ " "Database & Migration Integrity" \
  "pnpm --filter @repo/database check-migrations && pnpm --filter @repo/database lint:migrations && node packages/database/scripts/lint-migrations.mjs --all --no-squawk" \
  "Run 'pnpm db:migrate:check' and 'pnpm lint:migrations' to resolve migration drift, rollback, or Squawk/RLS issues."

run_gate 18 "⚡" "Performance & Load Regression Budgets" \
  "node tools/audits/audit-performance-budgets.cjs" \
  "Run 'pnpm audit:perf-budgets' to fix CSS/bundle size overruns, sequential waterfalls, or missing k6 SLA thresholds."

run_gate 19 "🎭" "End-to-End User Journey Coverage" \
  "node tools/audits/audit-e2e-journeys.cjs" \
  "Run 'pnpm audit:e2e-journeys' to fix missing E2E workflow coverage or committed test.only calls."

run_gate 20 "⛓️ " "Dependency & Supply-Chain Security" \
  "node tools/audits/audit-supply-chain.cjs" \
  "Run 'pnpm audit:supply-chain' to resolve exposed secrets, unsafe lifecycle scripts, or high/critical advisories."

run_gate 21 "📡" "Production Observability & Resilience" \
  "node tools/audits/audit-observability-resilience.cjs" \
  "Run 'pnpm audit:resilience' to fix health/readiness probes, OpenTelemetry spans, or Redis fallback resilience."

run_gate 22 "🚀" "Build, Deployment & Rollback Verification" \
  "node tools/scripts/vercel-preflight.cjs" \
  "Run 'pnpm audit:vercel' to fix Vercel monorepo build/deployment/environment preflight errors."

run_gate 23 "♿" "Accessibility & Frontend Regression" \
  "node tools/audits/check-html-meta-tags.cjs && node tools/audits/audit-design-tokens.cjs && node tools/audits/audit-image-optimization.cjs" \
  "Fix HTML meta/landmark tags, light-mode OKLCH token violations, or image optimization regressions."

# ── Stage 3: AI Agent Governance, Hallucination & Evidence Gates (24–27) ─────
run_gate 25 "🛡️ " "Agent Execution & Tool Permissions" \
  "node tools/audits/audit-agent-permissions.cjs" \
  "Run 'pnpm audit:agent-permissions' to fix .qoder hook bindings or path/commit guard scripts."

run_gate 26 "🧠" "AI Output Quality & Hallucination Controls" \
  "node tools/audits/audit-ai-hallucination.cjs" \
  "Run 'pnpm audit:ai-hallucination' to remove hallucinated imports, unexported @repo/* subpaths, or Next.js 16 boundary drift."

# Assemble machine-readable JSON manifest for Gates 24 & 27 independent verification
node -e '
const fs = require("node:fs");
const lines = fs.readFileSync(process.argv[1], "utf8").trim().split("\n").filter(Boolean);
const gates = lines.map((l) => JSON.parse(l));
const manifest = {
  runId: process.argv[2],
  startedAt: process.argv[3],
  gates,
};
fs.writeFileSync(process.argv[4], JSON.stringify(manifest, null, 2) + "\n", "utf8");
' "${TMP_GATES_NDJSON}" "${RUN_ID}" "${STARTED_AT}" "${EVIDENCE_JSON}"
rm -f "${TMP_GATES_NDJSON}"

echo -n "🔎 24 & 27. Evidence Integrity & Independent Reproducibility... "
if node tools/audits/verify-27-gates.cjs --verify-manifest "${EVIDENCE_JSON}" > /dev/null 2>&1; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
  echo "AGENT DIRECTIVE: Run 'node tools/audits/verify-27-gates.cjs --verify-manifest ${EVIDENCE_JSON}' to inspect evidence or reproducibility failures."
  exit 1
fi

READINESS_TIER=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).readinessClassification)' "${EVIDENCE_JSON}")

echo "========================================================"
echo "✅ [AGENT VERIFICATION] 27/27 GATES PASSED (100% PASS)"
echo "📋 Readiness Tier: ${READINESS_TIER}"
echo "📄 Evidence JSON:  ${EVIDENCE_JSON}"
echo "📄 JUnit Report:   .ci-local/agent-verify-junit.xml"
echo "========================================================"
