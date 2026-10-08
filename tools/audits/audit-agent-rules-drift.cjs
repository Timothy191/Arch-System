#!/usr/bin/env node

/**
 * @file tools/audits/audit-agent-rules-drift.cjs
 * @description Workspace↔Arch-System agent-rule drift guard.
 *
 * `.agents/rules/` (workspace-wide) and `Arch-System/.agents/rules/` (project)
 * hold hand-copied duplicates. Copies drift silently: the root copy of
 * execution-guardrails.md has a §9 "Anti-Bloat Dynamic Leases" section that the
 * Arch-System copy lost. Both are loaded as permanent rules, so drift means
 * different sessions obey different governance.
 *
 * This gate fails when a rule file that exists in BOTH trees has diverged. Fix by
 * editing one side and syncing the other, not by deleting the assertion.
 *
 * Exit codes: 0 = identical, 1 = drift detected.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const WORKSPACE_ROOT = path.resolve(ROOT_DIR, '..');
const RULES_REL = path.join('.agents', 'rules');
const CANONICAL = path.join(ROOT_DIR, RULES_REL);
const MIRROR = path.join(WORKSPACE_ROOT, RULES_REL);

const chalk = {
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

console.log(chalk.bold(chalk.blue('=======================================================')));
console.log(chalk.bold(chalk.blue('🔍 [AUDIT] Agent Rule Drift (workspace ↔ Arch-System)')));
console.log(chalk.bold(chalk.blue('=======================================================')));

if (!fs.existsSync(MIRROR)) {
  console.log(chalk.yellow(`⏭  No workspace mirror at ${RULES_REL} — nothing to compare. PASS.`));
  process.exit(0);
}

const listRules = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort();

const canonicalFiles = listRules(CANONICAL);
const mirrorFiles = listRules(MIRROR);

// A rule present on only one side is legal: the workspace tree is a superset of
// concerns (cross-project), the project tree adds service-specific rules.
const shared = canonicalFiles.filter((f) => mirrorFiles.includes(f));
const drifted = [];

for (const name of shared) {
  const a = fs.readFileSync(path.join(CANONICAL, name), 'utf8');
  const b = fs.readFileSync(path.join(MIRROR, name), 'utf8');
  if (a !== b) drifted.push(name);
}

const onlyCanonical = canonicalFiles.filter((f) => !mirrorFiles.includes(f));
const onlyMirror = mirrorFiles.filter((f) => !canonicalFiles.includes(f));

console.log(chalk.gray(`  canonical: ${RULES_REL} (${canonicalFiles.length} rules)`));
console.log(
  chalk.gray(`  mirror:    ${RULES_REL} under workspace root (${mirrorFiles.length} rules)`)
);
console.log(chalk.gray(`  shared:    ${shared.length}`));

if (onlyMirror.length > 0) {
  console.log(chalk.yellow(`  workspace-only rules (expected): ${onlyMirror.join(', ')}`));
}
if (onlyCanonical.length > 0) {
  console.log(`  project-only rules (expected): ${onlyCanonical.join(', ')}`);
}

if (drifted.length === 0) {
  console.log(chalk.bold(chalk.green('\n✅ PASS — every shared agent rule is byte-identical.')));
  process.exit(0);
}

console.log(
  chalk.bold(chalk.red(`\n❌ FAIL — ${drifted.length} shared agent rule(s) have drifted:`))
);
for (const name of drifted) {
  const a = fs.readFileSync(path.join(CANONICAL, name), 'utf8').split('\n');
  const b = fs.readFileSync(path.join(MIRROR, name), 'utf8').split('\n');
  console.log(chalk.red(`  • ${name}`));
  console.log(chalk.gray(`      ${a.length} lines (project) vs ${b.length} lines (workspace)`));
  console.log(
    chalk.yellow(
      `      RESOLVE: pick the authoritative text, then copy it to BOTH trees — ` +
        `Arch-System/.agents/rules/${name} and .agents/rules/${name}`
    )
  );
}
console.log(
  chalk.bold(
    chalk.red('\nDrifted rules are loaded as permanent governance, so sessions diverge silently.')
  )
);
process.exit(1);
