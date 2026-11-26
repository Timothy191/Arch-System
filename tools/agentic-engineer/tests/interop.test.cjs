'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildHeartbeat, runEnvelopeRoundtrip, validateEnvelope } = require('../lib/a2a.cjs');
const { loadConfig, isAgentContentPath } = require('../lib/constants.cjs');
const { discoverComponents } = require('../lib/component-registry.cjs');
const { runInteropValidation } = require('../lib/interop-validator.cjs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const { config } = loadConfig(ROOT);

function temporaryRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ae-interop-'));
}

test('real repository passes every interoperability check', () => {
  const result = runInteropValidation(ROOT);
  assert.equal(result.ok, true);
  assert.equal(result.score, 100);
  assert.equal(result.total, 14);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.violations, []);
});

test('component discovery pairs agents with registry cards', () => {
  const components = discoverComponents(ROOT);
  assert.ok(components.agents.length >= 19);
  assert.equal(components.agents.length, components.registry.length);
  assert.ok(components.skills.length > 0);
  assert.ok(components.rules.length > 0);
  assert.ok(components.schemas.length > 0);
  assert.ok(components.hooks.scripts.length > 0);
  assert.ok(
    components.agents.some((agent) => agent.name === config.instance.name),
    'the deployed instance agent is discoverable'
  );
});

test('A2A envelopes roundtrip and reject invalid heartbeats', () => {
  const roundtrip = runEnvelopeRoundtrip({
    sender: 'agentic-engineer',
    recipient: 'core-coordinator',
  });
  assert.equal(roundtrip.ok, true);
  assert.equal(roundtrip.results.length, 3);

  const invalid = buildHeartbeat({ agentId: 'agentic-engineer', status: 'SLEEPING' });
  const errors = validateEnvelope('status-heartbeat', invalid);
  assert.ok(errors.some((error) => error.includes('status must be one of')));
  assert.deepEqual(
    validateEnvelope('unknown-kind', invalid).slice(-1)[0],
    'unknown envelope kind "unknown-kind"'
  );
});

test('agent-content path detection honors roots and runtime excludes', () => {
  assert.equal(isAgentContentPath('.agents/agents/example/agent.md', config), true);
  assert.equal(isAgentContentPath('.agents/skills/agentic-engineer/SKILL.md', config), true);
  assert.equal(isAgentContentPath('AGENTS.md', config), true);
  assert.equal(isAgentContentPath('.agents/a2a/bus/event-log.jsonl', config), false);
  assert.equal(isAgentContentPath('.agents/a2a/whiteboard/claims.json', config), false);
  assert.equal(isAgentContentPath('apps/portal/src/app/page.tsx', config), false);
});

test('parity check fails when an agent definition lacks a registry card', () => {
  const root = temporaryRoot();
  try {
    const agentPath = path.join(root, '.agents/agents/ghost/agent.md');
    fs.mkdirSync(path.dirname(agentPath), { recursive: true });
    fs.writeFileSync(agentPath, '---\nname: ghost\n---\n\n# Ghost\n');
    const result = runInteropValidation(root);
    const parity = result.checks.find((check) => check.id === 'agents.parity');
    assert.equal(result.ok, false);
    assert.equal(parity.status, 'fail');
    assert.ok(parity.failures.some((failure) => failure.includes('ghost')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
