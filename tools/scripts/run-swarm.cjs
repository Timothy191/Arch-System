#!/usr/bin/env node

/**
 * @fileoverview Multi-agent swarm orchestration runner for the Arch-Systems monorepo.
 *
 * This script is the production replacement for the previous placeholder static checker.
 * It reads the local .a2a agent registry, classifies the current worktree by domain,
 * and emits an orchestration plan that maps each domain to the most relevant specialist
 * agents. In a headless/CI context it prints the plan as JSON; in an interactive
 * context the plan can be consumed by `pnpm corpos tick` or by Claude Code workflows.
 *
 * Usage:
 *   node tools/scripts/run-swarm.cjs              # classify current worktree
 *   node tools/scripts/run-swarm.cjs --plan-only   # emit JSON plan, no agent banner
 *   node tools/scripts/run-swarm.cjs --check       # run lightweight static quality gates
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const REGISTRY_DIR = path.join(ROOT, ".a2a", "registry");
const DEFAULT_OUTPUT = path.join(ROOT, "temp", "swarm-plan.json");

const DOMAIN_AGENTS = {
  "apps/portal": ["ui-engineer", "security-quality-gatekeeper", "api-integrator"],
  "libs/features/auth": ["security-quality-gatekeeper", "ui-engineer"],
  "libs/features/departments": ["resilience-field-engineer", "realtime-telemetry-engineer", "ui-engineer"],
  "libs/shared": ["code-generator-agent", "system-simplifier"],
  "packages/ui": ["ui-engineer", "ui-evaluator-agent", "ui-component-refactor-agent"],
  "packages/theme": ["ui-engineer", "ui-evaluator-agent"],
  "packages/contract": ["openspec-contract-auditor"],
  "packages/agents": ["autonomous-orchestrator", "kiro-claude-orchestrator"],
  "packages/database": ["database-architect"],
  "packages/supabase": ["database-architect", "security-quality-gatekeeper"],
  "packages/utils": ["code-generator-agent", "compound-bash-auditor"],
  "scripts/": ["compound-bash-auditor", "sidekick-deployment-engineer"],
  "infra/": ["sidekick-deployment-engineer", "resilience-field-engineer"],
  "documentation/": ["ai-memory-curator", "quartermaster-review-synthesizer"],
  ".agents/": ["autonomous-watchdog-supervisor", "ai-memory-curator"],
};

const QUALITY_PATTERNS = [
  { regex: /\bdark:[a-zA-Z0-9_-]+/, violation: "DARK_MODE_PROHIBITED", reason: "Prohibited dark: responsive class" },
  { regex: /\/\/\s*@ts-ignore|\/\/\s*@ts-nocheck|^\s*\*\s*@ts-(ignore|nocheck)/, violation: "TS_SUPPRESS", reason: "TypeScript suppression directive" },
  { regex: /\bany\b/, violation: "EXPLICIT_ANY", reason: "Unqualified any type", paths: ["apps/", "packages/", "libs/"] },
  { regex: /(SELECT|INSERT|UPDATE|DELETE)\s+.*\+\s*[a-zA-Z0-9_]+/i, violation: "DYNAMIC_SQL", reason: "Dynamic SQL string concatenation" },
  { regex: /console\.(log|warn|error|debug)\(/, violation: "DEBUG_LOG", reason: "Stray console log", paths: ["apps/portal/app/", "packages/", "libs/"] },
];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function loadAgentRegistry() {
  if (!fs.existsSync(REGISTRY_DIR)) return [];
  return fs
    .readdirSync(REGISTRY_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(path.join(REGISTRY_DIR, f)))
    .filter(Boolean);
}

function getModifiedFiles() {
  try {
    return execSync("git status --short", { cwd: ROOT, encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => line.slice(3).replace(/"/g, ""));
  } catch {
    return [];
  }
}

function matchAgents(file, registry) {
  const tags = [];
  for (const [prefix, agents] of Object.entries(DOMAIN_AGENTS)) {
    if (file.startsWith(prefix)) tags.push(...agents);
  }
  return [...new Set(tags)]
    .map((id) => {
      const entry = registry.find((a) => a.id === id || a.name === id);
      return entry ? { id, name: entry.name, description: entry.description } : { id, name: id, description: "" };
    });
}

function groupByDomain(files) {
  const groups = {};
  for (const file of files) {
    let domain = "other";
    for (const prefix of Object.keys(DOMAIN_AGENTS).sort((a, b) => b.length - a.length)) {
      if (file.startsWith(prefix)) {
        domain = prefix.replace(/\/$/, "").replace(/\//g, "-");
        break;
      }
    }
    (groups[domain] ||= []).push(file);
  }
  return groups;
}

function runStaticQualityChecks(files) {
  const violations = [];
  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(file)) continue;
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      for (const pattern of QUALITY_PATTERNS) {
        if (pattern.paths && !pattern.paths.some((p) => file.startsWith(p))) continue;
        if (pattern.regex.test(line)) {
          violations.push({
            file,
            line: idx + 1,
            violation: pattern.violation,
            reason: pattern.reason,
          });
        }
      }
    });
  }
  return violations;
}

function buildPlan(files, registry) {
  const groups = groupByDomain(files);
  const domains = Object.entries(groups).map(([domain, domainFiles]) => {
    const agents = matchAgents(domainFiles[0], registry);
    return {
      domain,
      files: domainFiles,
      recommended_agents: agents,
      file_count: domainFiles.length,
    };
  });

  const qualityViolations = runStaticQualityChecks(files);
  const riskFiles = files.filter(
    (f) =>
      /\/(auth|admin)\//.test(f) ||
      /app\/api\//.test(f) ||
      /webhook/.test(f) ||
      /features\/auth/.test(f) ||
      /features\/admin/.test(f) ||
      /scripts\/deploy/.test(f),
  );

  return {
    repo: ROOT,
    branch: execSync("git branch --show-current", { cwd: ROOT, encoding: "utf8" }).trim(),
    generated_at: new Date().toISOString(),
    total_files: files.length,
    domains,
    risk_files: riskFiles,
    quality_violations: qualityViolations,
    next_steps: [
      "Review risk_files manually or escalate to security-quality-gatekeeper",
      "Dispatch recommended_agents per domain via Claude Code Workflow or `pnpm corpos tick`",
      "Re-run `pnpm agent:swarm --check` after fixes to confirm zero quality violations",
    ],
  };
}

function main() {
  const planOnly = process.argv.includes("--plan-only");
  const checkOnly = process.argv.includes("--check");
  const files = getModifiedFiles();
  const registry = loadAgentRegistry();
  const plan = buildPlan(files, registry);

  fs.mkdirSync(path.dirname(DEFAULT_OUTPUT), { recursive: true });
  fs.writeFileSync(DEFAULT_OUTPUT, JSON.stringify(plan, null, 2) + "\n", "utf8");

  if (planOnly) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (checkOnly) {
    console.log(`🛡️  Static quality check: ${plan.quality_violations.length} violation(s)`);
    for (const v of plan.quality_violations.slice(0, 20)) {
      console.log(`  ❌ [${v.violation}] ${v.file}:${v.line} — ${v.reason}`);
    }
    if (plan.quality_violations.length === 0) {
      console.log("🟢 Zero critical static violations detected.");
    }
    process.exit(plan.quality_violations.length > 0 ? 1 : 0);
  }

  console.log("🚀 Arch-Systems Swarm Orchestration Plan\n");
  console.log(`Workspace: ${plan.repo}`);
  console.log(`Branch:    ${plan.branch}`);
  console.log(`Files:     ${plan.total_files}`);
  console.log(`Agents:    ${registry.length} registered\n`);

  for (const d of plan.domains) {
    console.log(`📦 ${d.domain} (${d.file_count} files)`);
    for (const a of d.recommended_agents) {
      console.log(`   🤖 ${a.name}${a.description ? ` — ${a.description}` : ""}`);
    }
  }

  console.log(`\n⚠️  Risk files requiring manual/security review: ${plan.risk_files.length}`);
  for (const f of plan.risk_files.slice(0, 10)) {
    console.log(`   • ${f}`);
  }
  if (plan.risk_files.length > 10) {
    console.log(`   ... and ${plan.risk_files.length - 10} more`);
  }

  console.log(`\n🛡️  Static quality violations: ${plan.quality_violations.length}`);
  console.log(`\n📝 Plan written to ${DEFAULT_OUTPUT}`);
  console.log("Next: dispatch agents per domain or run `pnpm agent:swarm --check`");
}

main();
