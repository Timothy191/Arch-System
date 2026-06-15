#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJ = '/home/timothy/Project/Arch-Mk2';

function loadPolicy() {
  const mode = process.env.SAFETY_MODE || 'default';
  const p = path.join(PROJ, '.kiro', 'safety', 'policies', `${mode}.json`);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return JSON.parse(fs.readFileSync(path.join(PROJ, '.kiro', 'safety', 'policies', 'default.json'), 'utf8')); }
}

function getTempDir() {
  const d = path.join(os.tmpdir(), 'kiro-safety');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function getSessionId() {
  const raw = process.env.CLAUDE_SESSION_ID || String(process.ppid) || 'default';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

module.exports = function budgetLayer(toolCall, context) {
  const policy = context.policy;
  const sessionId = getSessionId();
  const budgetFile = path.join(getTempDir(), `budget-${sessionId}`);
  const toolSpecificFile = path.join(getTempDir(), `budget-${sessionId}-${toolCall.tool}`);

  let total = 0;
  if (fs.existsSync(budgetFile)) {
    total = parseInt(fs.readFileSync(budgetFile, 'utf8').trim(), 10) || 0;
  }
  total++;
  fs.writeFileSync(budgetFile, String(total));

  let toolCount = 0;
  if (fs.existsSync(toolSpecificFile)) {
    toolCount = parseInt(fs.readFileSync(toolSpecificFile, 'utf8').trim(), 10) || 0;
  }
  toolCount++;
  fs.writeFileSync(toolSpecificFile, String(toolCount));

  const limits = policy.budget;
  const toolLimit = limits.per_tool_limits[toolCall.tool] || limits.block_at;

  if (total >= limits.block_at) {
    return { allow: false, reason: `Session budget exhausted: ${total}/${limits.block_at} tool calls`, severity: 'block', layer: '01-budget' };
  }
  if (toolCount >= toolLimit) {
    return { allow: false, reason: `Tool ${toolCall.tool} budget exhausted: ${toolCount}/${toolLimit} calls`, severity: 'block', layer: '01-budget' };
  }
  if (total >= limits.warn_at) {
    return { allow: true, reason: `Approaching budget limit: ${total}/${limits.block_at} tool calls`, severity: 'warn', layer: '01-budget' };
  }

  return { allow: true, reason: `Budget OK (${total}/${limits.block_at})`, severity: 'info', layer: '01-budget' };
};
