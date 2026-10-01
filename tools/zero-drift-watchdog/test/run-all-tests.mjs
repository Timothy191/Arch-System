#!/usr/bin/env node
// @ts-check
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const testSuites = [
  { name: 'Mock Infrastructure Fixtures', file: 'test/fixtures/fixtures.test.mjs' },
  { name: 'Tier 1: Feature Coverage', file: 'test/e2e/tier1_feature.test.mjs' },
  { name: 'Tier 2: Boundary & Corner Cases', file: 'test/e2e/tier2_boundary.test.mjs' },
  { name: 'Tier 3: Pairwise Combinations', file: 'test/e2e/tier3_combinations.test.mjs' },
  { name: 'Tier 4: Real-World Scenarios', file: 'test/e2e/tier4_realworld.test.mjs' },
];

console.log('='.repeat(70));
console.log('  ZERO DRIFT WATCHDOG - COMPREHENSIVE E2E TEST SUITE RUNNER');
console.log('='.repeat(70));
console.log(`Node.js version: ${process.version}`);
console.log(`Execution root:  ${rootDir}`);
console.log(`Total suites:    ${testSuites.length}`);
console.log('-'.repeat(70));

const testFilePaths = testSuites.map((s) => path.join(rootDir, s.file));

const startTime = Date.now();
const result = spawnSync(process.execPath, ['--test', ...testFilePaths], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
});
const durationMs = Date.now() - startTime;

console.log('-'.repeat(70));
if (result.status === 0) {
  console.log(`[PASS] ALL TEST SUITES PASSED CLEANLY (${durationMs}ms)`);
  console.log('='.repeat(70));
  process.exit(0);
} else {
  console.error(`[FAIL] TEST RUN FAILED with exit code ${result.status} (${durationMs}ms)`);
  console.log('='.repeat(70));
  process.exit(result.status ?? 1);
}
