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

// NOTE: entries must be resolved with statSync, not the readdir dirent. A dirent
// reports isFile() === false for a symlink, so filtering on it would silently
// drop every symlinked rule and make this gate vacuously PASS.
const listRules = (dir) =>
  fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .filter((name) => {
      try {
        return fs.statSync(path.join(dir, name)).isFile();
      } catch {
        return false; // broken symlink
      }
    })
    .sort();

const isSymlink = (dir, name) => fs.lstatSync(path.join(dir, name)).isSymbolicLink();

const canonicalFiles = listRules(CANONICAL);
const mirrorFiles = listRules(MIRROR);

// A rule present on only one side is legal: the workspace tree is a superset of
// concerns (cross-project), the project tree adds service-specific rules.
const shared = canonicalFiles.filter((f) => mirrorFiles.includes(f));
const drifted = [];
const broken = [];

for (const name of shared) {
  // A symlinked mirror is resolved by construction: it cannot hold stale content.
  // Its only real failure mode is a broken or misdirected link.
  if (isSymlink(MIRROR, name)) {
    const target = fs.readlinkSync(path.join(MIRROR, name));
    const resolved = path.resolve(MIRROR, target);
    if (resolved !== path.join(CANONICAL, name)) {
      broken.push({ name, target, resolved });
    }
    continue;
  }
  const a = fs.readFileSync(path.join(CANONICAL, name), 'utf8');
  const b = fs.readFileSync(path.join(MIRROR, name), 'utf8');
  if (a !== b) drifted.push(name);
}

const linked = shared.filter((f) => isSymlink(MIRROR, f));
const copied = shared.filter((f) => !isSymlink(MIRROR, f));
// Every .md entry in the mirror must resolve to a readable file that exists in the
// canonical tree. A broken link, or a link to a rule the project does not define, is a
// failure — it would otherwise be misfiled as an acceptable "workspace-only" rule.
const dangling = [];
for (const name of fs.readdirSync(MIRROR).filter((n) => n.endsWith('.md'))) {
  const full = path.join(MIRROR, name);
  let readable = true;
  try {
    fs.statSync(full);
  } catch {
    readable = false;
  }
  const pointsAtCanonical =
    readable && canonicalFiles.includes(name) && fs.lstatSync(full).isSymbolicLink();
  if (!readable || !pointsAtCanonical) {
    dangling.push({ name, readable, existsInCanonical: canonicalFiles.includes(name) });
  }
}

const onlyCanonical = canonicalFiles.filter((f) => !mirrorFiles.includes(f));
const onlyMirror = mirrorFiles.filter((f) => !canonicalFiles.includes(f));

console.log(chalk.gray(`  canonical: ${RULES_REL} (${canonicalFiles.length} rules)`));
console.log(
  chalk.gray(`  mirror:    ${RULES_REL} under workspace root (${mirrorFiles.length} rules)`)
);
console.log(
  chalk.gray(`  shared:    ${shared.length} (${linked.length} symlinked, ${copied.length} copied)`)
);

if (onlyMirror.length > 0) {
  console.log(chalk.yellow(`  workspace-only rules (expected): ${onlyMirror.join(', ')}`));
}
if (onlyCanonical.length > 0) {
  console.log(`  project-only rules (expected): ${onlyCanonical.join(', ')}`);
}

// A mirror that resolves to zero rules means every link is broken or misdirected.
// That must fail loudly: silently comparing nothing is the worst outcome.
if (mirrorFiles.length === 0) {
  console.log(
    chalk.bold(
      chalk.red(
        '\n❌ FAIL — the workspace mirror exposes 0 readable rules. Every symlink is broken or misdirected.'
      )
    )
  );
  process.exit(1);
}

if (dangling.length > 0) {
  console.log(
    chalk.bold(
      chalk.red(
        `\n❌ FAIL — ${dangling.length} workspace rule(s) are not live links to the canonical tree:`
      )
    )
  );
  for (const { name, readable, existsInCanonical } of dangling) {
    console.log(chalk.red(`  • ${name}`));
    if (!readable) {
      console.log(chalk.gray('      reason: broken symlink (target does not resolve)'));
    } else if (!existsInCanonical) {
      console.log(
        chalk.gray(`      reason: symlink target missing from ${RULES_REL} in the project tree`)
      );
    } else {
      console.log(chalk.gray('      reason: expected a symlink, found a regular file'));
    }
    console.log(
      chalk.yellow(
        `      RESOLVE: ln -sf ../../Arch-System/.agents/rules/${name} .agents/rules/${name}`
      )
    );
  }
  process.exit(1);
}

if (broken.length > 0) {
  console.log(
    chalk.bold(
      chalk.red(`\n❌ FAIL — ${broken.length} symlink(s) do not point at the canonical rule:`)
    )
  );
  for (const { name, target, resolved } of broken) {
    console.log(chalk.red(`  • ${name}`));
    console.log(chalk.gray(`      link target: ${target}`));
    console.log(chalk.gray(`      resolves to: ${resolved}`));
    console.log(chalk.gray(`      expected:    ${path.join(CANONICAL, name)}`));
  }
  process.exit(1);
}

if (drifted.length === 0) {
  console.log(
    chalk.bold(
      chalk.green(
        `\n✅ PASS — ${linked.length} rule(s) symlinked to source of truth, ` +
          `${copied.length} copied and byte-identical.`
      )
    )
  );
  process.exit(0);
}

console.log(chalk.bold(chalk.red(`\n❌ FAIL — ${drifted.length} copied rule(s) have drifted:`)));
for (const name of drifted) {
  const a = fs.readFileSync(path.join(CANONICAL, name), 'utf8').split('\n');
  const b = fs.readFileSync(path.join(MIRROR, name), 'utf8').split('\n');
  console.log(chalk.red(`  • ${name}`));
  console.log(chalk.gray(`      ${a.length} lines (project) vs ${b.length} lines (workspace)`));
  console.log(
    chalk.yellow(
      `      RESOLVE: edit Arch-System/.agents/rules/${name} only, then replace the hand-copy ` +
        `with: ln -sf ../../Arch-System/.agents/rules/${name} .agents/rules/${name}`
    )
  );
}
console.log(
  chalk.bold(
    chalk.red('\nDrifted rules are loaded as permanent governance, so sessions diverge silently.')
  )
);
process.exit(1);
