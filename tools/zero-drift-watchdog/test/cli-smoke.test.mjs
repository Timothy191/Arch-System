import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, '../bin/zero-drift-watchdog.mjs');

test('watchdog cli --audit-only clean auth failure', () => {
  try {
    execSync(`node ${binPath} --audit-only`, {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, GITHUB_TOKEN: 'dummy', VERCEL_TOKEN: 'dummy' },
    });
    assert.fail('Should have exited non-zero');
  } catch (error) {
    assert.strictEqual(error.status, 2, `expected clean auth failure (2), got ${error.status}`);
    const noInternalErrors = !/ReferenceError|TypeError|at Object\.<anonymous>/.test(error.stderr);
    assert.ok(noInternalErrors, 'unexpected internal error leaked to stderr: ' + error.stderr);
  }
});
