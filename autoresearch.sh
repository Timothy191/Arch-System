#!/usr/bin/env bash
set -euo pipefail

cd /home/timothy/orca/Arch-System

# ── Autoresearch baseline harness ─────────────────────────────────────────────
# Goal: establish a reproducible performance baseline for the Arch-System codebase.
# Workload: run the repository's primary quality commands deterministically.
# Primary metric: portal_test_duration_ms — wall-clock time for portal Jest suites.
# Secondary metrics: type_check_duration_ms, build_duration_ms, test_count, pass_rate.
#
# Constraints:
# - Deterministic every run (fixed nx cache behavior, no time-of-day deps)
# - Uses project tooling only (pnpm, nx, jest, tsc)
# - Exits 0 on success, non-zero on failure
# - Emits METRIC lines for parsers

FIXED_SEED=${AUTORESEARCH_SEED:-42}

echo "=== autoresearch baseline ==="
echo "seed=$FIXED_SEED"
echo "workdir=$(pwd)"
echo "node=$(node --version)"
echo "pnpm=$(pnpm --version)"
echo "date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ── 0. Optional reset for determinism ───────────────────────────────────────
if [ "${AUTORESEARCH_RESET_NX:-false}" = "true" ]; then
  pnpm nx reset 2>&1 | tail -n 1
fi

# ── 1. Portal unit tests (Jest) ──────────────────────────────────────────────
echo "--- running portal tests ---"
test_start_ms=$(date +%s%N)
pnpm --filter portal test 2>&1 | tee /tmp/autoresearch-test-output.txt
test_end_ms=$(date +%s%N)
test_duration_ms=$(( (test_end_ms - test_start_ms) / 1000000 ))

# Parse Jest summary from filtered portal run.
# Jest final lines: "Test Suites: N passed, N total" / "Tests: N passed, N total"
# Field layout: "Test Suites: <n> passed, <n> total" -> $3; "Tests: <n> passed, <n> total" -> $3; passed -> $2.
# Field layout: "Test Suites: <n> passed, <n> total" -> $3 passed, $5 total
# "Tests: <n> passed, <n> total" -> $2 passed, $4 total
test_suites=$(grep -E "^Test Suites:" /tmp/autoresearch-test-output.txt | tail -n 1 | awk '{print $5}')
test_count=$(grep -E "^Tests:" /tmp/autoresearch-test-output.txt | tail -n 1 | awk '{print $4}')
pass_count=$(grep -E "^Tests:" /tmp/autoresearch-test-output.txt | tail -n 1 | awk '{print $2}')
test_suites=${test_suites:-0}
test_count=${test_count:-0}
pass_count=${pass_count:-0}
fail_count=$((test_count - pass_count))
pass_rate="0.0000"
if [ "$test_count" -gt 0 ] 2>/dev/null; then
  pass_rate=$(awk "BEGIN {printf \"%.4f\", ($pass_count / $test_count)}")
fi

echo "METRIC portal_test_duration_ms=$test_duration_ms"
echo "METRIC portal_test_suites=$test_suites"
echo "METRIC portal_test_count=$test_count"
echo "METRIC portal_pass_count=$pass_count"
echo "METRIC portal_fail_count=$fail_count"
echo "METRIC portal_pass_rate=$pass_rate"

# ── 2. Type-check (tsc via nx) ──────────────────────────────────────────────
echo "--- running type-check ---"
type_start_ms=$(date +%s%N)
pnpm type-check 2>&1 | tail -n 5
type_end_ms=$(date +%s%N)
type_duration_ms=$(( (type_end_ms - type_start_ms) / 1000000 ))
echo "METRIC type_check_duration_ms=$type_duration_ms"

# ── 3. Build (nx run-many) ──────────────────────────────────────────────────
echo "--- running build ---"
build_start_ms=$(date +%s%N)
pnpm build 2>&1 | tail -n 5
build_end_ms=$(date +%s%N)
build_duration_ms=$(( (build_end_ms - build_start_ms) / 1000000 ))
echo "METRIC build_duration_ms=$build_duration_ms"

# ── Summary ──────────────────────────────────────────────────────────────────
echo "=== baseline complete ==="
echo "primary=portal_test_duration_ms"
echo "value=$test_duration_ms ms"
echo "pass_rate=$pass_rate ($pass_count/$test_count suites=$test_suites)"
echo "type_check=$type_duration_ms ms"
echo "build=$build_duration_ms ms"

# Sanity checks
if [ "$pass_rate" != "1.0000" ]; then
  echo "FAIL: tests did not pass (pass_rate=$pass_rate)" >&2
  exit 1
fi

exit 0
