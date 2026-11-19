#!/usr/bin/env node
'use strict';

/**
 * @file tools/scripts/agent-lifecycle.cjs
 * @description Universal cross-agent lifecycle CLI and stop-hook guard.
 * Enforces: Assess -> [ ] Checklist -> Isolated Branch -> Complete All Related
 * Actions -> Empirical Verification -> Safe Commit & Clean Merge.
 *
 * Usage:
 *   node tools/scripts/agent-lifecycle.cjs start --branch <type>/<scope> [--task "<summary>"] [--items "a|b"]
 *   node tools/scripts/agent-lifecycle.cjs checklist [status|verify|add "<text>"|check <index>|clear]
 *   node tools/scripts/agent-lifecycle.cjs clean-check [--strict]
 *   node tools/scripts/agent-lifecycle.cjs finish --message "<type>(<scope>): <summary>" [--merge] [--push] [--verify=fast|full|none]
 */

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CHECKLIST_REL = path.join('.ci-local', 'active-checklist.md');
const CHECKLIST_PATH = path.join(ROOT, CHECKLIST_REL);

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function getCurrentBranch() {
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    return 'HEAD';
  }
}

function getDirtyEntries() {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return out
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function branchExists(branchName) {
  const res = spawnSync('git', ['rev-parse', '--verify', '--quiet', branchName], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  return res.status === 0;
}

function parseFlags(tokens) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '--') continue;
    if (token.startsWith('--')) {
      const eqIdx = token.indexOf('=');
      if (eqIdx !== -1) {
        flags[token.slice(2, eqIdx)] = token.slice(eqIdx + 1);
      } else {
        const key = token.slice(2);
        const next = tokens[i + 1];
        if (next && !next.startsWith('--')) {
          flags[key] = next;
          i += 1;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positional.push(token);
    }
  }
  return { flags, positional };
}

function readChecklist() {
  if (!fs.existsSync(CHECKLIST_PATH)) {
    return { exists: false, raw: '', items: [] };
  }
  const raw = fs.readFileSync(CHECKLIST_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);
  const items = [];
  lines.forEach((line, lineIndex) => {
    const match = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)$/);
    if (match) {
      items.push({
        index: items.length + 1,
        lineIndex,
        checked: match[1].toLowerCase() === 'x',
        text: match[2].trim(),
      });
    }
  });
  return { exists: true, raw, lines, items };
}

function runStart(tokens) {
  const { flags } = parseFlags(tokens);
  const currentBranch = getCurrentBranch();
  const targetBranch = typeof flags.branch === 'string' ? flags.branch.trim() : '';
  const shouldSwitch = Boolean(flags.switch);
  let activeBranch = currentBranch;

  if (targetBranch && (currentBranch === 'main' || currentBranch === 'master' || shouldSwitch)) {
    if (currentBranch !== targetBranch) {
      if (branchExists(targetBranch)) {
        git(['checkout', targetBranch]);
      } else {
        git(['checkout', '-b', targetBranch]);
      }
      activeBranch = targetBranch;
      console.log(`🌿 Switched to branch '${activeBranch}'.`);
    }
  } else if (currentBranch === 'main' || currentBranch === 'master') {
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
    const autoBranch = `chore/task-${stamp}`;
    git(['checkout', '-b', autoBranch]);
    activeBranch = autoBranch;
    console.log(`🌿 Created isolated task branch '${activeBranch}'.`);
  }

  const taskSummary =
    typeof flags.task === 'string' && flags.task.trim()
      ? flags.task.trim()
      : `Task on ${activeBranch}`;
  const rawItems =
    typeof flags.items === 'string' && flags.items.trim()
      ? flags.items
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : [
          'Assess affected files, contracts, and downstream references',
          'Implement primary changes and update all coupled imports/exports/docs/tests',
          'Verify all gates and run pnpm agent:finish for clean git closure',
        ];

  const md = [
    `# Active Agent Checklist`,
    ``,
    `- **Branch**: \`${activeBranch}\``,
    `- **Task**: ${taskSummary}`,
    `- **Started**: ${new Date().toISOString()}`,
    ``,
    ...rawItems.map((item) => `- [ ] ${item}`),
    ``,
  ].join('\n');

  fs.mkdirSync(path.dirname(CHECKLIST_PATH), { recursive: true });
  fs.writeFileSync(CHECKLIST_PATH, md, 'utf8');
  console.log(`📋 Initialized ${rawItems.length} checklist item(s) at ${CHECKLIST_REL}.`);
}

function runChecklist(tokens) {
  const { positional } = parseFlags(tokens);
  const action = positional[0] || 'status';

  if (action === 'clear') {
    if (fs.existsSync(CHECKLIST_PATH)) {
      fs.unlinkSync(CHECKLIST_PATH);
      console.log(`🧹 Cleared ${CHECKLIST_REL}.`);
    } else {
      console.log(`✓ No active checklist at ${CHECKLIST_REL}.`);
    }
    return;
  }

  if (action === 'add') {
    const text = positional.slice(1).join(' ').trim();
    if (!text) {
      console.error('❌ Usage: agent-lifecycle.cjs checklist add "<task description>"');
      process.exit(1);
    }
    if (!fs.existsSync(CHECKLIST_PATH)) {
      fs.mkdirSync(path.dirname(CHECKLIST_PATH), { recursive: true });
      fs.writeFileSync(CHECKLIST_PATH, '# Active Agent Checklist\n\n', 'utf8');
    }
    fs.appendFileSync(CHECKLIST_PATH, `- [ ] ${text}\n`, 'utf8');
    console.log(`➕ Added checklist item: ${text}`);
    return;
  }

  const state = readChecklist();

  if (action === 'check') {
    const idx = Number.parseInt(positional[1] || '', 10);
    if (!state.exists || !Number.isFinite(idx) || idx < 1 || idx > state.items.length) {
      console.error(`❌ Invalid checklist item index "${positional[1] || ''}".`);
      process.exit(1);
    }
    const target = state.items[idx - 1];
    state.lines[target.lineIndex] = state.lines[target.lineIndex].replace(/\[[ ]\]/, '[x]');
    fs.writeFileSync(CHECKLIST_PATH, state.lines.join('\n'), 'utf8');
    console.log(`✅ Checked #${idx}: ${target.text}`);
    return;
  }

  if (action === 'verify') {
    if (!state.exists) {
      console.log('✓ No active checklist file — checklist verification skipped.');
      return;
    }
    const open = state.items.filter((item) => !item.checked);
    if (open.length > 0) {
      console.error(`❌ ${open.length} checklist item(s) still unchecked in ${CHECKLIST_REL}:`);
      for (const item of open) {
        console.error(`   - [ ] (#${item.index}) ${item.text}`);
      }
      process.exit(1);
    }
    console.log(`✅ All ${state.items.length} checklist item(s) completed.`);
    return;
  }

  if (!state.exists) {
    console.log(`ℹ️  No active checklist at ${CHECKLIST_REL}.`);
    return;
  }

  const doneCount = state.items.filter((item) => item.checked).length;
  console.log(`📋 Checklist (${doneCount}/${state.items.length} complete):`);
  for (const item of state.items) {
    console.log(`   ${item.index}. [${item.checked ? 'x' : ' '}] ${item.text}`);
  }
}

function runCleanCheck(tokens) {
  const { flags } = parseFlags(tokens);
  const strict = Boolean(flags.strict);
  const dirty = getDirtyEntries();
  const state = readChecklist();
  const openItems = state.exists ? state.items.filter((item) => !item.checked) : [];

  if (dirty.length === 0 && openItems.length === 0) {
    console.log('✅ [AGENT LIFECYCLE] Clean worktree & 0 open checklist items.');
    process.exit(0);
  }

  console.log('⚠️  [AGENT LIFECYCLE] Incomplete session state detected:');
  if (openItems.length > 0) {
    console.log(`   • Open checklist items (${openItems.length}):`);
    for (const item of openItems) {
      console.log(`     - [ ] (#${item.index}) ${item.text}`);
    }
  }
  if (dirty.length > 0) {
    console.log(`   • Uncommitted git entries (${dirty.length}):`);
    for (const entry of dirty.slice(0, 15)) {
      console.log(`     ${entry}`);
    }
    if (dirty.length > 15) {
      console.log(`     ... and ${dirty.length - 15} more`);
    }
  }
  console.log(
    '   ACTION: Finish all remaining [ ] items, verify, then run `pnpm agent:finish -- --message "<type>(<scope>): <summary>" --merge` before concluding.'
  );
  process.exit(strict ? 2 : 0);
}

function runCommandOrExit(command, args) {
  const res = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

function runFinish(tokens) {
  const { flags } = parseFlags(tokens);
  const message = typeof flags.message === 'string' ? flags.message.trim() : '';
  const shouldMerge = Boolean(flags.merge);
  const shouldPush = Boolean(flags.push);
  const verifyMode = typeof flags.verify === 'string' ? flags.verify : 'fast';
  const allowMain = Boolean(flags['allow-main']);

  runChecklist(['verify']);

  const dirty = getDirtyEntries();
  let currentBranch = getCurrentBranch();

  if (dirty.length === 0) {
    console.log('✓ Working tree is already clean.');
  } else {
    if (!message) {
      console.error(
        '❌ --message "<type>(<scope>): <summary>" is required to commit dirty changes.'
      );
      process.exit(1);
    }
    if ((currentBranch === 'main' || currentBranch === 'master') && !allowMain) {
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const safeBranch = `chore/agent-finish-${stamp}`;
      git(['checkout', '-b', safeBranch]);
      currentBranch = safeBranch;
      console.log(`🌿 Protected '${currentBranch}' — branched off main before committing.`);
    }

    if (verifyMode === 'full') {
      console.log('🔍 Running full verification suite (pnpm agent:verify)...');
      runCommandOrExit('pnpm', ['agent:verify']);
    } else if (verifyMode === 'fast') {
      console.log('🔍 Running fast verification suite (pnpm agent:verify:fast)...');
      runCommandOrExit('pnpm', ['agent:verify:fast']);
    } else if (verifyMode !== 'none') {
      console.error(`❌ Invalid --verify="${verifyMode}". Expected fast, full, or none.`);
      process.exit(1);
    }

    runCommandOrExit('git', ['add', '-A']);
    runCommandOrExit('node', ['tools/scripts/pre-commit-guards.cjs']);
    runCommandOrExit('git', ['commit', '-m', message]);
    console.log(`✅ Committed changes on '${currentBranch}'.`);
  }

  if (shouldMerge && currentBranch !== 'main') {
    console.log(`🔀 Fast-forward merging '${currentBranch}' into 'main'...`);
    runCommandOrExit('git', ['checkout', 'main']);
    const mergeRes = spawnSync('git', ['merge', '--ff-only', currentBranch], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    if (mergeRes.status !== 0) {
      console.error(
        `❌ Safe fast-forward merge failed (local main diverged from '${currentBranch}'). Rebase or resolve manually.`
      );
      process.exit(mergeRes.status || 1);
    }
    runCommandOrExit('git', ['branch', '-d', currentBranch]);
    console.log(`🧹 Deleted merged branch '${currentBranch}'.`);
    currentBranch = 'main';
  }

  if (fs.existsSync(CHECKLIST_PATH)) {
    fs.unlinkSync(CHECKLIST_PATH);
  }

  if (shouldPush) {
    console.log(`🚀 Pushing '${currentBranch}' to origin...`);
    runCommandOrExit('git', ['push', 'origin', currentBranch]);
  }

  const remainingDirty = getDirtyEntries();
  if (remainingDirty.length > 0) {
    console.error(`❌ Working tree still has ${remainingDirty.length} uncommitted entry(ies).`);
    process.exit(1);
  }
  console.log(`✅ [AGENT FINISH] Clean git state on '${currentBranch}'.`);
}

function main() {
  const args = process.argv.slice(2);
  const subcommand = args[0] || 'clean-check';
  const rest = args.slice(1);

  switch (subcommand) {
    case 'start':
      runStart(rest);
      break;
    case 'checklist':
      runChecklist(rest);
      break;
    case 'clean-check':
      runCleanCheck(rest);
      break;
    case 'finish':
      runFinish(rest);
      break;
    default:
      console.error(
        `Unknown subcommand "${subcommand}". Expected: start | checklist | clean-check | finish`
      );
      process.exit(1);
  }
}

main();
