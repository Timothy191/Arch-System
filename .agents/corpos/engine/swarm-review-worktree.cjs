#!/usr/bin/env node
/**
 * @fileoverview Standalone swarm worktree review script.
 * Lists modified files, groups by domain, prints a JSON plan for agents to consume.
 * This runs in the main Node process, not inside a Workflow sandbox.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = "/home/tim/Projects/Next.js-Monorepo-Business-Portal";

const DOMAIN_GROUPS = [
  { id: "portal", label: "Portal App", prefixes: ["apps/portal/"] },
  { id: "ui-theme", label: "UI / Theme", prefixes: ["packages/ui/", "packages/theme/"] },
  { id: "features-shared", label: "Features / Shared", prefixes: ["libs/features/", "libs/shared/"] },
  { id: "infrastructure", label: "Infra Packages", prefixes: ["packages/contract/", "packages/utils/", "packages/agents/", "packages/database/", "packages/supabase/", "packages/redis/", "packages/errors/", "packages/rate-limiter/"] },
  { id: "docs-tooling", label: "Docs / Tooling / Scripts", prefixes: ["documentation/", "scripts/", "tools/", "archive/", ".agents/rules/", ".agents/corpos/"] },
];

function getModifiedFiles() {
  const stdout = execSync("git status --short", { cwd: REPO_ROOT, encoding: "utf8" });
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/"/g, ""));
}

function groupFiles(files) {
  const grouped = {};
  for (const g of DOMAIN_GROUPS) grouped[g.id] = [];
  grouped.unassigned = [];

  for (const file of files) {
    let assigned = false;
    for (const g of DOMAIN_GROUPS) {
      if (g.prefixes.some((p) => file.startsWith(p))) {
        grouped[g.id].push(file);
        assigned = true;
        break;
      }
    }
    if (!assigned) grouped.unassigned.push(file);
  }
  return grouped;
}

function main() {
  const files = getModifiedFiles();
  const grouped = groupFiles(files);
  const plan = {
    repo: REPO_ROOT,
    branch: execSync("git branch --show-current", { cwd: REPO_ROOT, encoding: "utf8" }).trim(),
    total_files: files.length,
    groups: DOMAIN_GROUPS.map((g) => ({ id: g.id, label: g.label, files: grouped[g.id] })),
    unassigned: grouped.unassigned,
    generated_at: new Date().toISOString(),
  };

  const outPath = path.join(REPO_ROOT, "temp", "swarm-review-input.json");
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(plan, null, 2));
}

main();
