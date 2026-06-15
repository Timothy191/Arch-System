#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';

function getSessionId() {
  const raw = process.env.CLAUDE_SESSION_ID || String(process.ppid) || 'default';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

module.exports = function auditLogLayer(toolCall, context) {
  const policy = context.policy;
  if (!policy.audit?.enabled) {
    return { allow: true, reason: 'Audit logging disabled', severity: 'info', layer: '06-audit-log' };
  }

  const result = context.lastResult || { allow: true, severity: 'info' };

  if (!policy.audit.log_all && !policy.audit.log_blocks && !policy.audit.log_warns) {
    return { allow: result.allow, reason: result.reason, severity: result.severity, layer: '06-audit-log' };
  }

  if (!policy.audit.log_all) {
    if (result.severity === 'block' && !policy.audit.log_blocks) return result;
    if (result.severity === 'warn' && !policy.audit.log_warns) return result;
  }

  const logDir = path.join(PROJ, 'ltm', 'store');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logPath = policy.audit.log_path || 'ltm/store/audit.jsonl';
  const fullPath = path.isAbsolute(logPath) ? logPath : path.join(PROJ, logPath);

  const entry = {
    type: 'audit',
    timestamp: new Date().toISOString(),
    session_id: getSessionId(),
    tool: toolCall.tool,
    decision: result.allow ? 'allow' : 'block',
    severity: result.severity,
    reason: result.reason,
    layer: result.layer || '06-audit-log'
  };

  try {
    fs.appendFileSync(fullPath, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.error(`[safety] audit-log write failed: ${e.message}`);
  }

  return { allow: result.allow, reason: result.reason, severity: result.severity, layer: '06-audit-log' };
};
