#!/usr/bin/env node

/**
 * @fileoverview Pre-Task Context Budget Check Hook
 * Runs before autonomous agent tasks to ensure context budget compliance
 *
 * Usage: Called automatically by agent orchestration systems before task execution
 */

const { execSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

try {
  console.log('💰 [Pre-Task Hook] Checking context budget & task-adaptive token allocation...');

  const args = process.argv.slice(2);
  if (args.length > 0 || process.env.TASK_PROMPT || process.env.TASK_COMPLEXITY) {
    const taskOut = execSync(`node tools/scripts/token-tracker.cjs task-budget ${args.join(' ')}`, {
      cwd: ROOT,
      encoding: 'utf-8',
    });
    console.log(taskOut.trim());
  }

  execSync('pnpm token:budget-check', {
    cwd: ROOT,
    stdio: 'pipe',
  });

  console.log('✅ [Pre-Task Hook] Context budget within limits');
  process.exit(0);
} catch (error) {
  console.error('❌ [Pre-Task Hook] Context budget exceeded');
  console.error(
    '💡 [Pre-Task Hook] Run `pnpm context:debloat` or `pnpm token:task-budget` to prune and calibrate context'
  );
  process.exit(1);
}
