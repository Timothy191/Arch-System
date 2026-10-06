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
  console.log('💰 [Pre-Task Hook] Checking context budget compliance...');

  const result = execSync('pnpm token:budget-check', {
    cwd: ROOT,
    stdio: 'pipe',
  });

  console.log('✅ [Pre-Task Hook] Context budget within limits');
  process.exit(0);
} catch (error) {
  console.error('❌ [Pre-Task Hook] Context budget exceeded');
  console.error('💡 [Pre-Task Hook] Run `pnpm context:debloat` to prune context bloat');
  process.exit(1);
}
