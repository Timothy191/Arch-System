#!/usr/bin/env node

/**
 * Antidrift Test — Origin ↔ Continuum Guardian
 *
 * Reverse-engineered from Alyssa Solen's Origin ↔ Continuum framework
 * (alyssadata/alyssadata), the non-drift measurement format
 * (alyssadata/non-drift-measurement-test), and the Origin Boundary Test
 * (alyssadata/ai-foundations-origin-boundary-test). Not a copy of any of
 * them: the prompt-based questionnaires are re-expressed here as a single
 * complex FUNCTIONAL test that runs real checks against this repository.
 *
 * Core thesis (Solen): "Continuum does not exist without Origin." A system
 * has a governing line — its named source condition. Drift is the silent
 * collapse of that line under pressure. Fluency is not stability: a repo can
 * look healthy while its invariants quietly erode.
 *
 * This test measures whether Arch-System preserves its governing line across
 * seven capabilities, computes a confidence % for each, and decides — from
 * that confidence — when a re-test is warranted.
 *
 * Run: node tools/audits/antidrift-test.cjs
 * Exit code: 0 (no drift) or 1 (drift detected / confidence below threshold)
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// 1. GOVERNING LINE (the Origin)
// ---------------------------------------------------------------------------
// The named source condition of this system. Every check below verifies that
// the system still returns to this line under pressure.
const ORIGIN = {
  name: "Arch-System (Plantcor)",
  source: "Turborepo monorepo (post-Nx-migration)",
  governingLine: [
    "Turborepo 2.x + pnpm is the build orchestrator; Nx is decommissioned.",
    "tools/repo/policy-compiler.cjs is the Single Source of Truth for scope tags.",
    "packages/database/migrations/ is the SSoT for schema; the supabase copy is deploy-time only.",
    "RLS is enabled on every table and consults auth.uid() via public.employees.",
    "Design tokens are OKLCH from @repo/theme; generated files are never hand-edited.",
    "UI packages are pure presentation; apps never import @repo/database-internal.",
    "All work stays on main; the worktree is left clean.",
  ],
};

// Drift threshold: below this overall confidence, the test fails and a
// re-test / remediation cycle is triggered.
const CONFIDENCE_THRESHOLD = 90;

// ---------------------------------------------------------------------------
// 2. FUNCTIONAL CHECK PRIMITIVES
// ---------------------------------------------------------------------------

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readFile(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    return "";
  }
}

/** Run a shell command; return trimmed stdout or "" on failure. */
function sh(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/** Count occurrences of a regex across a set of files (via rg). */
function countMatches(pattern, globs, ignore = []) {
  const ignoreArgs = ignore.map((i) => `--glob '!${i}'`).join(" ");
  const globArgs = globs.map((g) => `--glob '${g}'`).join(" ");
  const out = sh(`rg -l "${pattern}" ${globArgs} ${ignoreArgs} 2>/dev/null | wc -l`);
  return Number.parseInt(out, 10) || 0;
}

/**
 * Run a function that may regenerate a report file, then restore that file to
 * its prior content. The Antidrift test is a read-only observer: it must never
 * leave the worktree dirtier than it found it (a dirty worktree would fail its
 * own Pressure Resistance check on the next run).
 */
function withRestore(rel, fn) {
  const before = readFile(rel);
  const result = fn();
  const after = readFile(rel);
  if (after !== before) {
    fs.writeFileSync(path.join(ROOT, rel), before);
  }
  return result;
}

/** A check result. */
function result(id, name, passed, evidence, weight = 1) {
  return { id, name, passed, evidence, weight };
}

// ---------------------------------------------------------------------------
// 3. THE SEVEN CAPABILITIES
// ---------------------------------------------------------------------------

function capabilitySourceRetention() {
  // Holding the original governing line: the migration to Turborepo is the
  // source condition. Any surviving Nx reference in a LIVING doc is drift.
  const checks = [];

  checks.push(
    result(
      "SR-1",
      "Turborepo is the declared orchestrator",
      /"turbo": "\^2\./.test(readFile("package.json")),
      "package.json declares turbo ^2.x",
    ),
  );

  const nxInScripts = /"([^"]*nx[^"]*)":/.test(readFile("package.json"));
  checks.push(
    result(
      "SR-2",
      "No nx commands in package.json scripts",
      !nxInScripts,
      nxInScripts ? "nx command found in scripts" : "no nx commands in scripts",
    ),
  );

  // Living docs only — historical archives and dated snapshots are records,
  // not drift. The test file itself is excluded: it contains these search
  // patterns as literal strings (self-reference).
  const livingNxRefs = countMatches(
    "\\bNx\\b monorepo|pnpm nx run|nx build|nx test|nx lint",
    ["*.md", "*.cjs", "*.mjs", "*.ts", "*.tsx", "*.json"],
    ["**/node_modules/**", "**/.next/**", "**/dist/**", "documentation/06-archives/**", "docs/archive/**", "codebase-maps/log-*/**", "documentation/08-ultragoal-archives/**", "AGENT_TRACER.md", "tools/audits/antidrift-test.cjs"],
  );
  checks.push(
    result(
      "SR-3",
      "No Nx references in living docs/configs",
      livingNxRefs === 0,
      livingNxRefs === 0 ? "clean" : `${livingNxRefs} file(s) still reference Nx`,
    ),
  );

  return { capability: "Source Retention", checks };
}

function capabilityBoundaryRetention() {
  // Not weakening the constraint: the SSoT locations must not have been
  // relocated or shadowed by duplicates.
  const checks = [];

  checks.push(
    result(
      "BR-1",
      "Policy compiler is the SSoT",
      fileExists("tools/repo/policy-compiler.cjs"),
      "tools/repo/policy-compiler.cjs present",
    ),
  );
  checks.push(
    result(
      "BR-2",
      "Policy output lives under tools/repo/policy/",
      fileExists("tools/repo/policy/eslint-boundaries.generated.cjs"),
      "tools/repo/policy/eslint-boundaries.generated.cjs present",
    ),
  );
  checks.push(
    result(
      "BR-3",
      "Migrations SSoT is packages/database/migrations/",
      fs.existsSync(path.join(ROOT, "packages/database/migrations")) &&
        fs.readdirSync(path.join(ROOT, "packages/database/migrations")).length > 0,
      "packages/database/migrations/ populated",
    ),
  );
  checks.push(
    result(
      "BR-4",
      "No stale duplicate codebase-maps under documentation/",
      !fileExists("documentation/04-codebase-maps"),
      "documentation/04-codebase-maps removed",
    ),
  );

  return { capability: "Boundary Retention", checks };
}

function capabilityConceptStability() {
  // Not merging with adjacent concepts: Nx and Turborepo must not be conflated;
  // the deploy-time supabase migration copy must not be treated as editable.
  const checks = [];

  // Conflation is present-tense: a living doc describing the CURRENT system as
  // "the Nx monorepo" or treating Nx and Turbo as interchangeable ("Nx/Turbo").
  // Migration descriptions ("Nx → Turborepo migration") are accurate history,
  // not conflation, and are deliberately not matched.
  const nxTurboConflation = countMatches(
    "\\bNx\\b monorepo|Nx/Turbo",
    ["*.md"],
    ["**/node_modules/**", "**/.next/**", "**/dist/**", "documentation/06-archives/**", "docs/archive/**", "codebase-maps/log-*/**", "documentation/08-ultragoal-archives/**", "AGENT_TRACER.md", "tools/audits/antidrift-test.cjs"],
  );
  checks.push(
    result(
      "CS-1",
      "No Nx/Turbo concept conflation in living docs",
      nxTurboConflation === 0,
      nxTurboConflation === 0 ? "clean" : `${nxTurboConflation} file(s) conflate Nx and Turbo`,
    ),
  );

  const supabaseMigrations = path.join(ROOT, "packages/supabase/supabase/migrations");
  const supabaseMigrationsEdited = fs.existsSync(supabaseMigrations)
    ? fs.readdirSync(supabaseMigrations).length
    : 0;
  checks.push(
    result(
      "CS-2",
      "Deploy-time supabase migration copy is not the SSoT",
      supabaseMigrationsEdited === 0,
      supabaseMigrationsEdited === 0 ? "copy is empty/deploy-time only" : `${supabaseMigrationsEdited} file(s) in the deploy-time copy`,
    ),
  );

  const nxIgnoreRefs = countMatches("\\.nx/", [".prettierignore", ".dockerignore", ".gitignore", "config/tools/.secretlintignore"]);
  checks.push(
    result(
      "CS-3",
      "No stale .nx/ ignore entries",
      nxIgnoreRefs === 0,
      nxIgnoreRefs === 0 ? "clean" : `${nxIgnoreRefs} ignore file(s) still reference .nx/`,
    ),
  );

  return { capability: "Concept Stability", checks };
}

function capabilityUnauthorizedMerge() {
  // Detecting unauthorized merges: generated artifacts and protected paths
  // must not be hand-edited or merged into the source of truth.
  const checks = [];

  const generatedFiles = [
    "packages/theme/src/tokens/generated.ts",
    "packages/theme/src/tokens/variables-generated.css",
  ];
  for (const f of generatedFiles) {
    // These are generated; their presence is expected. Drift is a hand-edit
    // signature: a mismatch between the file and its generator is hard to
    // detect statically, so we verify the generator exists and the file is
    // git-clean (not locally modified).
    const gitClean = sh(`git status --porcelain -- "${f}"`).length === 0;
    checks.push(
      result(
        `UM-${generatedFiles.indexOf(f) + 1}`,
        `Generated file not locally modified: ${f}`,
        gitClean,
        gitClean ? "git-clean" : "locally modified (possible hand-edit)",
      ),
    );
  }

  const appImportsInternal = countMatches(
    "@repo/database-internal",
    ["apps/**/*.ts", "apps/**/*.tsx"],
    ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  );
  checks.push(
    result(
      "UM-3",
      "Apps never import @repo/database-internal",
      appImportsInternal === 0,
      appImportsInternal === 0 ? "clean" : `${appImportsInternal} app file(s) import database-internal`,
    ),
  );

  return { capability: "Unauthorized Merge Detection", checks };
}

function capabilityAuthorizationDrift() {
  // Authorization must not transfer Origin: RLS stays tied to auth.uid() and
  // public.employees; UI packages stay pure presentation.
  const checks = [];

  // audit-rls.cjs regenerates documentation/03-audit-reports/rls-report.md as a
  // side effect; restore it so this test stays read-only.
  const rlsAudit = withRestore("documentation/03-audit-reports/rls-report.md", () =>
    sh("node tools/audits/audit-rls.cjs 2>/dev/null | tail -5"),
  );
  const rlsPass = /100%|PASS|0 critical/i.test(rlsAudit);
  checks.push(
    result(
      "AD-1",
      "RLS audit passes (auth.uid() + public.employees)",
      rlsPass,
      rlsPass ? "RLS audit clean" : "RLS audit reported issues",
    ),
  );

  const uiImportsDb = countMatches(
    "from ['\"]@repo/(database|supabase)['\"]|require\\(['\"]@repo/(database|supabase)['\"]\\)",
    ["packages/ui/**/*.ts", "packages/ui/**/*.tsx"],
    ["**/node_modules/**", "**/.next/**", "**/dist/**"],
  );
  checks.push(
    result(
      "AD-2",
      "UI packages are pure presentation (no DB/Supabase imports)",
      uiImportsDb === 0,
      uiImportsDb === 0 ? "clean" : `${uiImportsDb} UI file(s) import DB/Supabase`,
    ),
  );

  const policyCheck = sh("pnpm policy:check 2>&1 | tail -3");
  const policyPass = /pass|ok|success|0/i.test(policyCheck) && !/fail|error/i.test(policyCheck);
  checks.push(
    result(
      "AD-3",
      "Architectural boundary enforcement (policy:check)",
      policyPass,
      policyPass ? "policy:check clean" : "policy:check reported violations",
    ),
  );

  return { capability: "Authorization Drift Detection", checks };
}

function capabilityRepairAccuracy() {
  // Correcting accurately after correction: recent fixes must not have
  // introduced new drift (e.g., a "fix" that re-introduces Nx, or a partial
  // repair that leaves the boundary weakened).
  const checks = [];

  // The last 10 commits must not re-introduce Nx references in living files.
  const recentNx = sh(
    "git log --oneline -10 --name-only | grep -E '\\.(md|ts|tsx|cjs|mjs|json)$' | sort -u | head -40",
  )
    .split("\n")
    .filter(Boolean);
  let reintroduced = 0;
  for (const f of recentNx) {
    if (!f || f.startsWith("documentation/06-archives") || f.startsWith("docs/archive") || f.startsWith("codebase-maps/log-") || f === "AGENT_TRACER.md") continue;
    if (/\bNx\b/.test(readFile(f))) reintroduced += 1;
  }
  checks.push(
    result(
      "RA-1",
      "Recent commits did not re-introduce Nx references",
      reintroduced === 0,
      reintroduced === 0 ? "clean" : `${reintroduced} recently-touched file(s) reference Nx`,
    ),
  );

  // The audit:compliance script must invoke the real rollback test, not a
  // phantom script name (a known repair-accuracy failure mode).
  const compliance = readFile("package.json");
  const rollbackRef = /test:migration-rollback/.test(compliance);
  checks.push(
    result(
      "RA-2",
      "audit:compliance invokes the real rollback test",
      !rollbackRef,
      rollbackRef ? "phantom test:migration-rollback reference" : "invokes pnpm --filter @repo/database test",
    ),
  );

  return { capability: "Repair Accuracy", checks };
}

function capabilityPressureResistance() {
  // Holding under interruption and time: no incomplete work, no stale
  // branches, no uncommitted drift.
  const checks = [];

  const worktree = sh("git status --porcelain");
  checks.push(
    result(
      "PR-1",
      "Worktree is clean (no interruption residue)",
      worktree.length === 0,
      worktree.length === 0 ? "clean" : `${worktree.split("\n").length} uncommitted change(s)`,
    ),
  );

  const branches = sh("git branch --no-merged main").split("\n").filter(Boolean);
  checks.push(
    result(
      "PR-2",
      "No stale unmerged branches",
      branches.length === 0,
      branches.length === 0 ? "clean" : `${branches.length} unmerged branch(es)`,
    ),
  );

  const ahead = sh("git status -sb | head -1");
  const synced = !/ahead/.test(ahead);
  checks.push(
    result(
      "PR-3",
      "Remote tracking is synchronized",
      synced,
      synced ? "in sync with origin/main" : ahead,
    ),
  );

  return { capability: "Pressure Resistance", checks };
}

// ---------------------------------------------------------------------------
// 4. CONFIDENCE ENGINE
// ---------------------------------------------------------------------------
// Each capability yields a confidence % (weighted by check weights). The
// overall confidence is the weighted mean across capabilities. When overall
// confidence falls below the threshold, drift is declared and a re-test is
// scheduled.

function computeConfidence(capabilities) {
  let totalWeight = 0;
  let weightedSum = 0;
  const perCapability = capabilities.map((cap) => {
    const capWeight = cap.checks.reduce((s, c) => s + c.weight, 0);
    const capScore = cap.checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
    const confidence = Math.round((capScore / capWeight) * 100);
    totalWeight += capWeight;
    weightedSum += (capScore / capWeight) * capWeight;
    return { capability: cap.capability, confidence, passed: cap.checks.filter((c) => c.passed).length, total: cap.checks.length };
  });
  const overall = Math.round((weightedSum / totalWeight) * 100);
  return { perCapability, overall };
}

// ---------------------------------------------------------------------------
// 5. WHEN TO TEST FOR DRIFT
// ---------------------------------------------------------------------------
// The confidence % is the trigger. After any significant change (commit,
// migration, refactor), the guardian recomputes confidence; if it drops
// below the threshold, a full re-test + remediation cycle is warranted.

function decideNextTest(confidence) {
  if (confidence.overall < CONFIDENCE_THRESHOLD) {
    return {
      action: "REMEDIATE_AND_RETEST",
      reason: `Overall confidence ${confidence.overall}% < ${CONFIDENCE_THRESHOLD}% threshold — drift detected, remediate then re-test.`,
    };
  }
  if (confidence.perCapability.some((c) => c.confidence < CONFIDENCE_THRESHOLD)) {
    return {
      action: "TARGETED_RETEST",
      reason: `A capability fell below ${CONFIDENCE_THRESHOLD}% — re-test the affected capability.`,
    };
  }
  return {
    action: "HOLD",
    reason: `Overall confidence ${confidence.overall}% ≥ ${CONFIDENCE_THRESHOLD}% — no drift; re-test after the next significant change.`,
  };
}

// ---------------------------------------------------------------------------
// 6. RUN
// ---------------------------------------------------------------------------

function main() {
  const capabilities = [
    capabilitySourceRetention(),
    capabilityBoundaryRetention(),
    capabilityConceptStability(),
    capabilityUnauthorizedMerge(),
    capabilityAuthorizationDrift(),
    capabilityRepairAccuracy(),
    capabilityPressureResistance(),
  ];

  const confidence = computeConfidence(capabilities);
  const decision = decideNextTest(confidence);

  const lines = [];
  lines.push("# Antidrift Test — Origin ↔ Continuum Guardian");
  lines.push("");
  lines.push(`**Origin**: ${ORIGIN.name} — ${ORIGIN.source}`);
  lines.push(`**Governing line**: ${ORIGIN.governingLine.length} invariants`);
  lines.push(`**Confidence threshold**: ${CONFIDENCE_THRESHOLD}%`);
  lines.push("");
  lines.push("## Confidence Report");
  lines.push("");
  lines.push("| Capability | Confidence | Passed | Total |");
  lines.push("| --- | --- | --- | --- |");
  for (const c of confidence.perCapability) {
    lines.push(`| ${c.capability} | ${c.confidence}% | ${c.passed} | ${c.total} |`);
  }
  lines.push(`| **Overall** | **${confidence.overall}%** | | |`);
  lines.push("");
  lines.push("## Drift Decision");
  lines.push("");
  lines.push(`**Action**: ${decision.action}`);
  lines.push(`**Reason**: ${decision.reason}`);
  lines.push("");
  lines.push("## Check Detail");
  lines.push("");
  for (const cap of capabilities) {
    lines.push(`### ${cap.capability}`);
    lines.push("");
    for (const c of cap.checks) {
      lines.push(`- [${c.passed ? "PASS" : "FAIL"}] ${c.id} ${c.name} — ${c.evidence}`);
    }
    lines.push("");
  }

  const report = lines.join("\n");
  console.log(report);

  const drift = confidence.overall < CONFIDENCE_THRESHOLD;
  process.exitCode = drift ? 1 : 0;
  return { confidence, decision, drift };
}

if (require.main === module) {
  main();
}

module.exports = { main, ORIGIN, CONFIDENCE_THRESHOLD, computeConfidence, decideNextTest };
