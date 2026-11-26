'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadConfig } = require('../lib/constants.cjs');
const {
  appendLedger,
  emitAlert,
  healthStatus,
  runHealth,
  verifyLedger,
} = require('../lib/monitoring.cjs');
const { readJsonl } = require('../lib/util.cjs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const { config } = loadConfig(ROOT);

function temporaryStateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ae-state-'));
}

test('audit ledger chains entries and detects tampering', () => {
  const stateDir = temporaryStateDir();
  try {
    appendLedger({ stateDir, config, action: 'INIT', subject: 'instance', result: 'ok' });
    appendLedger({
      stateDir,
      config,
      action: 'TASK_CREATED',
      subject: 'ae-0001',
      result: 'queued',
    });
    appendLedger({
      stateDir,
      config,
      action: 'TASK_COMPLETED',
      subject: 'ae-0001',
      result: 'done',
    });

    const ledgerPath = path.join(stateDir, config.state.ledgerFile);
    const verified = verifyLedger(ledgerPath);
    assert.equal(verified.ok, true);
    assert.equal(verified.entries, 3);

    const records = readJsonl(ledgerPath).records;
    records[1].result = 'tampered';
    fs.writeFileSync(ledgerPath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
    const tampered = verifyLedger(ledgerPath);
    assert.equal(tampered.ok, false);
    assert.ok(tampered.failures.some((failure) => failure.includes('hash mismatch')));
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('healthStatus maps scores to healthy, degraded, and failed', () => {
  const { thresholds } = config;
  assert.equal(healthStatus(100, 100, thresholds), 'healthy');
  assert.equal(healthStatus(100, 60, thresholds), 'degraded');
  assert.equal(healthStatus(72, 100, thresholds), 'failed');
});

test('emitAlert appends to the alert sink without a configured webhook', async () => {
  const stateDir = temporaryStateDir();
  const previous = process.env[config.alerts.webhookEnv];
  delete process.env[config.alerts.webhookEnv];
  try {
    const result = await emitAlert({
      stateDir,
      config,
      alert: { severity: 'critical', checkId: 'agents.parity', message: 'missing registry card' },
    });
    assert.equal(result.webhook.published, false);
    const alerts = readJsonl(path.join(stateDir, config.state.alertsFile)).records;
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].checkId, 'agents.parity');
    assert.equal(alerts[0].source, config.instance.name);
  } finally {
    if (previous !== undefined) process.env[config.alerts.webhookEnv] = previous;
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('runHealth reports a healthy integrated repository', async () => {
  const stateDir = temporaryStateDir();
  try {
    const health = await runHealth({ root: ROOT, stateDir, config });
    assert.equal(health.status, 'healthy');
    assert.equal(health.interop.score, 100);
    assert.equal(health.documentation.completeness, 100);
    assert.equal(health.alerts.length, 0);
    assert.equal(health.graph.ok, true);
    assert.ok(fs.existsSync(path.join(stateDir, config.state.healthFile)));
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});
