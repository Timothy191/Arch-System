#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

function getTempDir() {
  const d = path.join(os.tmpdir(), 'kiro-safety');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function getSessionId() {
  const raw = process.env.CLAUDE_SESSION_ID || String(process.ppid) || 'default';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

module.exports = function rateLimiterLayer(toolCall, context) {
  const policy = context.policy;
  const sessionId = getSessionId();
  const now = Date.now();
  const windowMs = 60000;
  const rateFile = path.join(getTempDir(), `ratelimit-${sessionId}.json`);

  let state = { calls: [] };
  if (fs.existsSync(rateFile)) {
    try { state = JSON.parse(fs.readFileSync(rateFile, 'utf8')); }
    catch { state = { calls: [] }; }
  }

  state.calls = state.calls.filter(t => now - t < windowMs);
  state.calls.push({ tool: toolCall.tool, time: now });

  const recentTotal = state.calls.length;
  const recentPerTool = state.calls.filter(t => t.tool === toolCall.tool).length;
  fs.writeFileSync(rateFile, JSON.stringify(state));

  const limits = policy.rate_limit;
  const toolLimit = limits.per_tool_max_per_minute?.[toolCall.tool] || limits.max_calls_per_minute;

  if (recentTotal >= limits.max_calls_per_minute) {
    return { allow: false, reason: `Rate limit: ${recentTotal}/${limits.max_calls_per_minute} calls/min (all tools)`, severity: 'block', layer: '05-rate-limiter', cooldown: limits.cooldown_seconds };
  }
  if (recentPerTool >= toolLimit) {
    return { allow: false, reason: `Rate limit: ${recentPerTool}/${toolLimit} ${toolCall.tool} calls/min`, severity: 'block', layer: '05-rate-limiter', cooldown: limits.cooldown_seconds };
  }
  if (recentTotal >= limits.max_calls_per_minute * 0.8) {
    return { allow: true, reason: `Approaching rate limit: ${recentTotal}/${limits.max_calls_per_minute} calls/min`, severity: 'warn', layer: '05-rate-limiter' };
  }

  return { allow: true, reason: `Rate OK (${recentTotal}/${limits.max_calls_per_minute} calls/min)`, severity: 'info', layer: '05-rate-limiter' };
};
