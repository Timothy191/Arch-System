#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const EXCEPTIONS_FILE = path.join(PROJ, '.kiro', 'safety', 'exceptions.json');

function loadExceptions() {
  try { return JSON.parse(fs.readFileSync(EXCEPTIONS_FILE, 'utf8')); }
  catch { return { version: 1, exceptions: [], trusted_sessions: [] }; }
}

function saveExceptions(data) {
  fs.writeFileSync(EXCEPTIONS_FILE, JSON.stringify(data, null, 2));
}

function getSessionId() {
  const raw = process.env.CLAUDE_SESSION_ID || String(process.ppid) || 'default';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

function matchOperation(tool, input, pattern) {
  const colonIdx = pattern.indexOf('(');
  if (colonIdx === -1) return pattern === tool || pattern === '*';
  const patternTool = pattern.slice(0, colonIdx);
  if (patternTool !== tool && patternTool !== '*') return false;
  return true;
}

module.exports = function userControlLayer(toolCall, context) {
  const policy = context.policy;
  const sessionId = getSessionId();
  const exceptions = loadExceptions();

  const isTrustedSession = exceptions.trusted_sessions.includes(sessionId);

  const trustedOps = policy.user_control?.trusted_operations || [];
  for (const pattern of trustedOps) {
    if (matchOperation(toolCall.tool, toolCall.input, pattern)) {
      return { allow: true, reason: `Trusted operation: ${pattern}`, severity: 'info', layer: '07-user-control' };
    }
  }

  for (const ex of exceptions.exceptions) {
    if (matchOperation(toolCall.tool, toolCall.input, ex.pattern)) {
      const expiresAt = new Date(ex.expires_at);
      if (expiresAt > new Date()) {
        return { allow: true, reason: `User-approved exception: ${ex.reason}`, severity: 'info', layer: '07-user-control' };
      }
    }
  }

  if (isTrustedSession) {
    return { allow: true, reason: 'Trusted session - all operations allowed', severity: 'info', layer: '07-user-control' };
  }

  const maxExceptions = policy.user_control?.max_exceptions_per_session || 10;
  const currentSessionExceptions = exceptions.exceptions.filter(e => e.session_id === sessionId).length;
  const canCreateException = currentSessionExceptions < maxExceptions;

  if (context.lastResult && !context.lastResult.allow && canCreateException) {
    return {
      allow: false,
      reason: `Operation blocked. To allow, add exception: { "pattern": "${toolCall.tool}(*)", "reason": "..." } to .kiro/safety/exceptions.json`,
      severity: 'warn',
      layer: '07-user-control',
      can_approve: true
    };
  }

  return { allow: true, reason: 'User control passed', severity: 'info', layer: '07-user-control' };
};
