'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CLI = path.join(ROOT, 'tools/agentic-engineer/bin/agentic-engineer.cjs');

function run(args) {
  return execFileSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('CLI validate exits clean and reports a 100% score', () => {
  const output = run(['validate', '--json']);
  const parsed = JSON.parse(output);
  assert.equal(parsed.score, 100);
  assert.equal(parsed.checks.length, 14);
  assert.ok(parsed.checks.every((check) => check.status === 'pass'));
});

test('CLI status confirms every control-plane surface is green', () => {
  const output = run(['status']);
  assert.match(output, /interop 100%/);
  assert.match(output, /docs 100%/);
  assert.match(output, /deployment registered/);
});

test('CLI gate and documentation checks pass on the branch diff', () => {
  const gate = run(['gate', '--ci']);
  assert.match(gate, /Gate ci: \d+ agent-content change\(s\), interop 100%, docs 100%/);
  const docs = run(['docs']);
  assert.match(docs, /Documentation completeness 100%/);
});

test('CLI init bootstraps state and audit verifies the ledger chain', () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-cli-'));
  try {
    const init = run(['init', '--state-dir', stateDir]);
    assert.match(init, /interop 100%/);
    assert.ok(fs.existsSync(path.join(stateDir, 'tasks.json')));
    assert.ok(fs.existsSync(path.join(stateDir, 'audit-ledger.jsonl')));
    const audit = run(['audit', '--state-dir', stateDir]);
    assert.match(audit, /Audit ledger verified/);
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('CLI watch --once evaluates the working tree without a long-lived watcher', () => {
  const output = run(['watch', '--once']);
  assert.match(output, /watch: interop 100%, docs 100%/);
});
