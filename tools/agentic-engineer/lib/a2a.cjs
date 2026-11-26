'use strict';

/**
 * A2A envelope builders and validators. Keeps the Agentic Engineer wired to the
 * same typed handoff, verdict, and heartbeat contracts used by the fleet.
 */

const path = require('node:path');

const { appendJsonl, nowIso } = require('./util.cjs');

const PHASES = ['INGESTION', 'DISCOVERY', 'EXECUTION', 'VERIFICATION', 'COMPLETION'];
const VERDICTS = ['PASS', 'WARNING', 'FAIL'];
const AGENT_STATUSES = ['IDLE', 'ACTIVE', 'DEGRADED', 'ERROR'];

function isTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function buildTaskHandoff(input = {}) {
  return {
    taskId: input.taskId,
    senderAgent: input.senderAgent,
    recipientAgent: input.recipientAgent,
    phase: input.phase,
    targetFiles: Array.isArray(input.targetFiles) ? input.targetFiles : [],
    inputPayload: input.inputPayload || {},
    constraints: Array.isArray(input.constraints) ? input.constraints : [],
    timestamp: input.timestamp || nowIso(),
  };
}

function buildReviewVerdict(input = {}) {
  return {
    taskId: input.taskId,
    auditorAgent: input.auditorAgent,
    verdict: input.verdict,
    score: typeof input.score === 'number' ? input.score : 0,
    violations: Array.isArray(input.violations) ? input.violations : [],
    recommendations: Array.isArray(input.recommendations) ? input.recommendations : [],
    timestamp: input.timestamp || nowIso(),
  };
}

function buildHeartbeat(input = {}) {
  return {
    agentId: input.agentId,
    status: input.status,
    activeTasks: Array.isArray(input.activeTasks) ? input.activeTasks : [],
    memoryUsageMb: typeof input.memoryUsageMb === 'number' ? input.memoryUsageMb : 0,
    timestamp: input.timestamp || nowIso(),
  };
}

function validateEnvelope(kind, envelope) {
  const errors = [];
  const requireString = (field) => {
    if (typeof envelope[field] !== 'string' || envelope[field].trim() === '') {
      errors.push(`${field} must be a non-empty string`);
    }
  };
  const requireArray = (field) => {
    if (!Array.isArray(envelope[field])) errors.push(`${field} must be an array`);
  };

  if (kind === 'task-handoff') {
    requireString('taskId');
    requireString('senderAgent');
    requireString('recipientAgent');
    if (!PHASES.includes(envelope.phase)) errors.push(`phase must be one of ${PHASES.join(', ')}`);
    requireArray('targetFiles');
    if (!envelope.inputPayload || typeof envelope.inputPayload !== 'object') {
      errors.push('inputPayload must be an object');
    }
    if (typeof envelope.taskId === 'string' && !/^[a-z0-9-_]+$/.test(envelope.taskId)) {
      errors.push('taskId must match ^[a-z0-9-_]+$');
    }
  } else if (kind === 'review-verdict') {
    requireString('taskId');
    requireString('auditorAgent');
    if (!VERDICTS.includes(envelope.verdict)) {
      errors.push(`verdict must be one of ${VERDICTS.join(', ')}`);
    }
    if (typeof envelope.score !== 'number' || envelope.score < 0 || envelope.score > 100) {
      errors.push('score must be a number between 0 and 100');
    }
    requireArray('violations');
  } else if (kind === 'status-heartbeat') {
    requireString('agentId');
    if (!AGENT_STATUSES.includes(envelope.status)) {
      errors.push(`status must be one of ${AGENT_STATUSES.join(', ')}`);
    }
    requireArray('activeTasks');
    if (typeof envelope.memoryUsageMb !== 'number') errors.push('memoryUsageMb must be a number');
  } else {
    errors.push(`unknown envelope kind "${kind}"`);
  }

  if (!isTimestamp(envelope.timestamp)) errors.push('timestamp must be an ISO-8601 date-time');
  return errors;
}

function buildBusEvent(input = {}) {
  const timestamp = input.timestamp || nowIso();
  return {
    eventId: input.eventId || `evt_${Date.parse(timestamp)}`,
    timestamp,
    eventType: input.eventType,
    sender: input.sender,
    recipient: input.recipient,
    taskId: input.taskId || null,
    payloadSummary: input.payloadSummary || '',
  };
}

function appendBusEvent(busDir, event) {
  const target = path.join(busDir, 'event-log.jsonl');
  appendJsonl(target, event);
  return event;
}

function runEnvelopeRoundtrip({
  sender = 'agentic-engineer',
  recipient = 'agentic-engineer',
} = {}) {
  const handoff = buildTaskHandoff({
    taskId: 'a2a-roundtrip-check',
    senderAgent: sender,
    recipientAgent: recipient,
    phase: 'EXECUTION',
    targetFiles: ['.agents/a2a/SPEC.md'],
    inputPayload: { intent: 'verify-envelope-interoperability' },
  });
  const verdict = buildReviewVerdict({
    taskId: handoff.taskId,
    auditorAgent: recipient,
    verdict: 'PASS',
    score: 100,
    violations: [],
  });
  const heartbeat = buildHeartbeat({
    agentId: recipient,
    status: 'ACTIVE',
    activeTasks: [handoff.taskId],
    memoryUsageMb: 0,
  });
  const results = [
    ['task-handoff', handoff],
    ['review-verdict', verdict],
    ['status-heartbeat', heartbeat],
  ].map(([kind, envelope]) => ({
    kind,
    ok: validateEnvelope(kind, JSON.parse(JSON.stringify(envelope))).length === 0,
  }));
  return { ok: results.every((entry) => entry.ok), results, handoff, verdict, heartbeat };
}

module.exports = {
  AGENT_STATUSES,
  PHASES,
  VERDICTS,
  appendBusEvent,
  buildBusEvent,
  buildHeartbeat,
  buildReviewVerdict,
  buildTaskHandoff,
  runEnvelopeRoundtrip,
  validateEnvelope,
};
