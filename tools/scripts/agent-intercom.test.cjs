/**
 * @file tools/scripts/agent-intercom.test.cjs
 * @description Unit tests for Agent Intercom & Whiteboard CLI manager (`agent-intercom.cjs`).
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Set isolated temporary whiteboard directory before requiring module
const TEMP_TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-whiteboard-test-'));
process.env.AGENT_WHITEBOARD_DIR = TEMP_TEST_DIR;

const {
  acquireFileClaim,
  releaseFileClaim,
  broadcastIntercomMessage,
  readClaimsData,
} = require('./agent-intercom.cjs');

const TEST_CLAIMS_FILE = path.join(TEMP_TEST_DIR, 'claims.json');
const TEST_INTERCOM_FILE = path.join(TEMP_TEST_DIR, 'intercom.jsonl');

describe('Agent Intercom & Whiteboard Concurrency Suite', () => {
  beforeEach(() => {
    fs.mkdirSync(TEMP_TEST_DIR, { recursive: true });
    fs.writeFileSync(
      TEST_CLAIMS_FILE,
      JSON.stringify(
        { $schema: 'http://json-schema.org/draft-07/schema#', activeClaims: [] },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(TEST_INTERCOM_FILE, '', 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(TEMP_TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('Given an unclaimed file, when an agent acquires a claim, then it is successfully recorded', () => {
    const agentId = 'test-agent-alpha';
    const filePath = 'apps/portal/app/test.tsx';

    acquireFileClaim({ agentId, filePath, intent: 'Testing acquisition' });

    const store = readClaimsData();
    assert.strictEqual(store.activeClaims.length, 1);
    assert.strictEqual(store.activeClaims[0].agentId, agentId);
    assert.strictEqual(store.activeClaims[0].filePath, filePath);
    assert.strictEqual(store.$schema, 'http://json-schema.org/draft-07/schema#');
  });

  it('Given a claimed file, when another agent attempts to claim it, then it throws a conflict error', () => {
    const agentOne = 'test-agent-alpha';
    const agentTwo = 'test-agent-beta';
    const filePath = 'apps/portal/app/shared.tsx';

    acquireFileClaim({ agentId: agentOne, filePath, intent: 'Editing shared' });

    assert.throws(() => {
      acquireFileClaim({ agentId: agentTwo, filePath, intent: 'Conflicting edit' });
    }, /Conflict: File/);
  });

  it('Given an active claim, when the same agent acquires it again, then its TTL is renewed', () => {
    const agentId = 'test-agent-alpha';
    const filePath = 'apps/portal/app/test.tsx';

    acquireFileClaim({ agentId, filePath, intent: 'First intent' });
    acquireFileClaim({ agentId, filePath, intent: 'Renewed intent', ttlMs: 60_000 });

    const store = readClaimsData();
    assert.strictEqual(store.activeClaims.length, 1);
    assert.strictEqual(store.activeClaims[0].intent, 'Renewed intent');
  });

  it('Given an active claim, when the owner agent releases it, then the claim is removed', () => {
    const agentId = 'test-agent-alpha';
    const filePath = 'apps/portal/app/test.tsx';

    acquireFileClaim({ agentId, filePath, intent: 'To be released' });
    releaseFileClaim({ agentId, filePath });

    const store = readClaimsData();
    assert.strictEqual(store.activeClaims.length, 0);
  });

  it('Given the intercom channel, when an agent broadcasts a message, then it is appended to intercom.jsonl', () => {
    const sender = 'test-agent-alpha';
    const content = 'Refactored contract schemas successfully.';

    broadcastIntercomMessage({ sender, content, recipient: 'ALL', messageType: 'UPDATE' });

    const rawLog = fs.readFileSync(TEST_INTERCOM_FILE, 'utf8').trim();
    const entry = JSON.parse(rawLog);

    assert.strictEqual(entry.sender, sender);
    assert.strictEqual(entry.content, content);
    assert.strictEqual(entry.messageType, 'UPDATE');
  });
});
