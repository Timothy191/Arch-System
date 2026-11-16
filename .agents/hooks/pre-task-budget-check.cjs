#!/usr/bin/env node

/**
 * @fileoverview Pre-Task Context Budget Tracking Hook (non-blocking)
 * Runs before autonomous agent tasks to report context budget & task-adaptive
 * token allocation. Tracking/warning only: never blocks or restrains agent
 * execution, never exits non-zero.
 *
 * Usage: Called automatically by agent orchestration systems before task execution
 */

const { execSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

try {
  console.log(
    '📊 [Pre-Task Hook] Reporting context budget & task-adaptive token allocation (tracking only)...'
  );

  const args = process.argv.slice(2);
  if (args.length > 0 || process.env.TASK_PROMPT || process.env.TASK_COMPLEXITY) {
    try {
      const taskOut = execSync(
        `node tools/scripts/token-tracker.cjs task-budget ${args.join(' ')}`,
        {
          cwd: ROOT,
          encoding: 'utf-8',
        }
      );
      console.log(taskOut.trim());
    } catch (_e) {
      console.warn('⚠️ [Pre-Task Hook] task-budget report unavailable (non-blocking)');
    }
  }

  try {
    execSync('pnpm token:budget-check', { cwd: ROOT, stdio: 'pipe' });
  } catch (_e) {
    console.warn(
      '⚠️ [Pre-Task Hook] budget-check reported over-limits (non-blocking, tracking only)'
    );
  }

  console.log(
    '✅ [Pre-Task Hook] Budget tracking complete — agent is never blocked by token limits'
  );
} catch (_error) {
  console.warn('⚠️ [Pre-Task Hook] Budget tracking hook encountered an error (non-blocking)');
}

// Always exit 0: token budget must never restrain or block agent execution.
process.exit(0);
