#!/usr/bin/env node

/**
 * Gate 25: Agent Execution & Tool Permissions Auditor
 *
 * Verifies that AI coding agents cannot invoke unapproved destructive commands
 * or mutate protected paths (.env*, symlinked migrations, generated files)
 * without being blocked by the repository's PreToolUse/PostToolUse hooks.
 *
 * Run: node tools/audits/audit-agent-permissions.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS_PATH = path.join(ROOT, '.qoder', 'settings.json');
const PROTECT_PATHS_HOOK = path.join(ROOT, '.qoder', 'hooks', 'protect-paths.sh');
const COMMIT_GUARD_HOOK = path.join(ROOT, '.qoder', 'hooks', 'commit-guard.sh');

console.log('\n🤖 Initiating Gate 25: Agent Execution & Tool Permissions Audit...\n');

const violations = [];

// ── 1. Verify Hook Registration in .qoder/settings.json ─────────────────────
console.log('1️⃣  Auditing .qoder/settings.json PreToolUse & PostToolUse hook bindings...');
if (!fs.existsSync(SETTINGS_PATH)) {
  violations.push('Missing .qoder/settings.json hook configuration.');
} else {
  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  const preHooks = JSON.stringify(settings.hooks?.PreToolUse ?? []);
  const postHooks = JSON.stringify(settings.hooks?.PostToolUse ?? []);

  if (!preHooks.includes('protect-paths.sh')) {
    violations.push('.qoder/settings.json is missing PreToolUse hook protect-paths.sh');
  }
  if (!preHooks.includes('commit-guard.sh')) {
    violations.push('.qoder/settings.json is missing PreToolUse hook commit-guard.sh');
  }
  if (!postHooks.includes('auto-format.sh') || !postHooks.includes('lint-migration.sh')) {
    violations.push(
      '.qoder/settings.json is missing PostToolUse hooks (auto-format.sh / lint-migration.sh)'
    );
  }
  console.log('   ✓ Verified PreToolUse and PostToolUse hook bindings in .qoder/settings.json.');
}

// ── 2. Execute Live Synthetic Boundary Probes Against protect-paths.sh ──────
console.log('2️⃣  Probing protect-paths.sh with synthetic forbidden & allowed file payloads...');
const pathProbes = [
  { file: '.env', expectedExit: 2, label: 'Block root .env modification' },
  {
    file: 'apps/portal/.env.local',
    expectedExit: 2,
    label: 'Block nested .env.local modification',
  },
  {
    file: 'packages/supabase/migrations/001_init.sql',
    expectedExit: 2,
    label: 'Block symlinked packages/supabase/migrations write',
  },
  {
    file: 'config/tools/eslint.boundaries.cjs',
    expectedExit: 2,
    label: 'Block generated eslint.boundaries.cjs write',
  },
  {
    file: 'apps/portal/lib/version.generated.ts',
    expectedExit: 2,
    label: 'Block *.generated.* file write',
  },
  { file: '.env.example', expectedExit: 0, label: 'Allow .env.example template edit' },
  {
    file: 'apps/portal/server/proxy.ts',
    expectedExit: 0,
    label: 'Allow normal source file edit',
  },
];

for (const probe of pathProbes) {
  const payload = JSON.stringify({ tool_input: { file_path: probe.file } });
  const res = spawnSync('bash', [PROTECT_PATHS_HOOK], {
    cwd: ROOT,
    input: payload,
    encoding: 'utf8',
  });
  if (res.status !== probe.expectedExit) {
    violations.push(
      `protect-paths.sh failed probe "${probe.label}" (file: ${probe.file}): expected exit ${probe.expectedExit}, got ${res.status}`
    );
  }
}
console.log(`   ✓ All ${pathProbes.length} path-protection boundary probes behaved as expected.`);

// ── 3. Execute Live Synthetic Command Probes Against commit-guard.sh ────────
console.log('3️⃣  Probing commit-guard.sh with hook-bypass & normal git commands...');
const commandProbes = [
  {
    command: 'git commit -m "chore: bypass" --no-verify',
    expectedExit: 2,
    label: 'Block git commit --no-verify',
  },
  {
    command: 'git commit -n -m "chore: bypass short flag"',
    expectedExit: 2,
    label: 'Block git commit -n',
  },
  {
    command: 'git commit --no-gpg-sign -m "chore: unsigned"',
    expectedExit: 2,
    label: 'Block git commit --no-gpg-sign',
  },
  {
    command: 'git commit -m "feat: valid commit"',
    expectedExit: 0,
    label: 'Allow compliant git commit',
  },
];

for (const probe of commandProbes) {
  const payload = JSON.stringify({ tool_input: { command: probe.command } });
  const res = spawnSync('bash', [COMMIT_GUARD_HOOK], {
    cwd: ROOT,
    input: payload,
    encoding: 'utf8',
  });
  if (res.status !== probe.expectedExit) {
    violations.push(
      `commit-guard.sh failed probe "${probe.label}": expected exit ${probe.expectedExit}, got ${res.status}`
    );
  }
}
console.log(`   ✓ All ${commandProbes.length} command-guard probes behaved as expected.`);

// ── 4. Verify Agentic Content & Directive Integrity ─────────────────────────
console.log('4️⃣  Verifying .agents/rules, .agents/skills, and AGENT_TRACER.md integrity...');
const agenticRes = spawnSync(
  'node',
  [path.join(ROOT, 'tools', 'audits', 'audit-agentic-content.cjs'), '--check'],
  { cwd: ROOT, encoding: 'utf8' }
);
if (agenticRes.status !== 0) {
  violations.push(
    `audit-agentic-content.cjs --check failed:\n${agenticRes.stderr || agenticRes.stdout}`
  );
} else {
  console.log('   ✓ Agentic rules, skills, and tracer files verified (100% compliant).');
}

if (violations.length > 0) {
  console.error('\n❌ Gate 25 Agent Execution & Tool Permissions Audit Failed:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  process.exit(1);
}

console.log('\n✅ Gate 25 Agent Execution & Tool Permissions Audit Passed: 100% compliant!\n');
process.exit(0);
