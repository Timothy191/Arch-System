'use strict';

/**
 * Integration-health monitoring, alert sink, hash-chained audit ledger, and
 * health reporting for the Agentic Engineer.
 */

const path = require('node:path');

const { appendJsonl, hashRecord, nowIso, readJsonl, writeJson, writeText } = require('./util.cjs');
const { evaluateDocs } = require('./docs-governance.cjs');
const { runInteropValidation } = require('./interop-validator.cjs');
const { loadState, summary, validateGraph } = require('./coordination.cjs');

const GENESIS_HASH = 'GENESIS';

function readLedger(filePath) {
  return readJsonl(filePath).records;
}

function appendLedger({ stateDir, config, actor, action, subject, result, detail }) {
  const filePath = path.join(stateDir, config.state.ledgerFile);
  const records = readLedger(filePath);
  const previous = records.length > 0 ? records[records.length - 1] : null;
  const entry = {
    seq: previous ? Number(previous.seq) + 1 : 1,
    timestamp: nowIso(),
    actor: actor || config.instance.name,
    action,
    subject: subject || '',
    result: result || 'ok',
    detailHash: hashRecord(detail || {}),
    prevHash: previous ? previous.hash : GENESIS_HASH,
  };
  entry.hash = hashRecord(entry);
  appendJsonl(filePath, entry);
  return entry;
}

function verifyLedger(filePath) {
  const records = readLedger(filePath);
  const failures = [];
  let previousHash = GENESIS_HASH;
  records.forEach((record, index) => {
    if (record.seq !== index + 1) failures.push(`entry ${index + 1} has seq ${record.seq}`);
    if (record.prevHash !== previousHash) {
      failures.push(`entry ${record.seq} prevHash does not match the previous entry`);
    }
    const { hash, ...payload } = record;
    if (hashRecord(payload) !== hash) failures.push(`entry ${record.seq} hash mismatch`);
    previousHash = record.hash;
  });
  return { ok: failures.length === 0, entries: records.length, failures };
}

async function publishWebhook(config, payload) {
  const envName = config.alerts.webhookEnv;
  const url = envName ? process.env[envName] : '';
  if (!url) return { published: false, reason: 'webhook-not-configured' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    return { published: response.ok, reason: `http-${response.status}` };
  } catch (error) {
    return { published: false, reason: error.message };
  }
}

async function emitAlert({ stateDir, config, alert }) {
  const record = {
    timestamp: nowIso(),
    severity: alert.severity || 'warning',
    checkId: alert.checkId || 'unknown',
    message: alert.message || '',
    source: config.instance.name,
  };
  appendJsonl(path.join(stateDir, config.state.alertsFile), record);
  const webhook = await publishWebhook(config, { type: 'agentic-engineer.alert', ...record });
  return { record, webhook };
}

function healthStatus(interopScore, docsCompleteness, thresholds) {
  if (interopScore >= thresholds.interopScore && docsCompleteness >= thresholds.docsCompleteness) {
    return 'healthy';
  }
  if (interopScore >= thresholds.interopScore) return 'degraded';
  return 'failed';
}

async function runHealth({ root, stateDir, config }) {
  const generatedAt = nowIso();
  const interop = runInteropValidation(root);
  const docs = evaluateDocs({ root, config });
  const state = loadState(stateDir, config);
  const coordination = summary(state);
  const graph = validateGraph(state, config);
  const alerts = [];

  for (const violation of interop.violations) {
    alerts.push({
      severity: violation.severity,
      checkId: violation.checkId,
      message: violation.message,
    });
  }
  for (const failure of docs.failures) {
    alerts.push({ severity: 'critical', checkId: failure.id, message: failure.message });
  }
  for (const failure of graph.failures) {
    alerts.push({ severity: 'major', checkId: 'coordination.graph', message: failure });
  }

  const status = healthStatus(interop.score, docs.completeness, config.thresholds);
  const health = {
    generatedAt,
    instance: config.instance.name,
    status,
    interop: {
      score: interop.score,
      passed: interop.passed,
      total: interop.total,
      checks: interop.checks.map((entry) => ({
        id: entry.id,
        status: entry.status,
        severity: entry.severity,
      })),
    },
    documentation: {
      completeness: docs.completeness,
      passed: docs.passed,
      total: docs.total,
      checks: docs.checks.map((entry) => ({
        id: entry.id,
        ok: entry.ok,
      })),
    },
    coordination,
    graph,
    counts: interop.counts,
    alerts,
  };

  writeJson(path.join(stateDir, config.state.healthFile), health);
  for (const alert of alerts) {
    await emitAlert({ stateDir, config, alert });
  }
  return health;
}

function generateHealthReport(health) {
  const lines = [];
  lines.push('# Agentic Engineer Integration Health');
  lines.push('');
  lines.push(`> Generated by \`pnpm agent:engineer:health --write\` at ${health.generatedAt}.`);
  lines.push('');
  lines.push(`- Status: **${health.status.toUpperCase()}**`);
  lines.push(
    `- Interoperability score: **${health.interop.score}%** (${health.interop.passed}/${health.interop.total})`
  );
  lines.push(`- Documentation completeness: **${health.documentation.completeness}%**`);
  lines.push(`- Open coordination tasks: ${health.coordination.open}/${health.coordination.total}`);
  lines.push('');
  lines.push('## Interoperability Checks');
  lines.push('');
  lines.push('| Check | Status | Severity |');
  lines.push('| --- | --- | --- |');
  for (const entry of health.interop.checks) {
    lines.push(`| ${entry.id} | ${entry.status} | ${entry.severity} |`);
  }
  lines.push('');
  lines.push('## Documentation Checks');
  lines.push('');
  lines.push('| Check | Status |');
  lines.push('| --- | --- |');
  for (const entry of health.documentation.checks) {
    lines.push(`| ${entry.id} | ${entry.ok ? 'pass' : 'fail'} |`);
  }
  lines.push('');
  lines.push('## Component Counts');
  lines.push('');
  for (const [name, count] of Object.entries(health.counts)) {
    lines.push(`- ${name}: ${count}`);
  }
  lines.push('');
  lines.push('## Open Alerts');
  lines.push('');
  if (health.alerts.length === 0) {
    lines.push('_No active interoperability alerts._');
  } else {
    lines.push('| Severity | Check | Message |');
    lines.push('| --- | --- | --- |');
    for (const alert of health.alerts) {
      lines.push(
        `| ${alert.severity} | ${alert.checkId} | ${alert.message.replace(/\|/g, '\\|')} |`
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

function writeHealthReport(root, config, health) {
  const target = path.join(root, config.documentation.healthReport);
  writeText(target, generateHealthReport(health));
  return { path: config.documentation.healthReport };
}

module.exports = {
  appendLedger,
  emitAlert,
  generateHealthReport,
  healthStatus,
  readLedger,
  runHealth,
  verifyLedger,
  writeHealthReport,
};
