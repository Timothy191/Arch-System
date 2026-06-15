#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const STORE_DIR = path.join(PROJ, 'ltm', 'store');
const TRACE_LOG = path.join(STORE_DIR, 'traces.jsonl');
const METRICS_LOG = path.join(STORE_DIR, 'metrics.jsonl');

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
}

function appendJsonl(file, record) {
  ensureDir();
  fs.appendFileSync(file, JSON.stringify(record) + '\n');
}

function getSessionId() {
  return (process.env.CLAUDE_SESSION_ID || 'default').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

function recordTrace(hookType, input) {
  const trace = {
    trace_id: getSessionId() + '_' + Date.now(),
    timestamp: new Date().toISOString(),
    hook_type: hookType,
    service: process.env.OTEL_SERVICE_NAME || 'kiro-agent',
    tool: input.tool || input.tool_name || 'unknown',
    tool_input: sanitizeForLog(input.tool_input || input.arguments || {}),
    session_id: getSessionId(),
    status: 'ok'
  };
  appendJsonl(TRACE_LOG, trace);
}

function sanitizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  const secretPatterns = [/password/i, /secret/i, /token/i, /key/i, /auth/i, /credential/i];
  for (const [k, v] of Object.entries(obj)) {
    if (secretPatterns.some(p => p.test(k))) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'string' && v.length > 1000) {
      sanitized[k] = v.slice(0, 1000) + '...[truncated]';
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

function recordMetric(name, value, tags = {}) {
  const metric = {
    name,
    value,
    timestamp: Date.now(),
    session_id: getSessionId(),
    ...tags
  };
  appendJsonl(METRICS_LOG, metric);
  console.error(`[metrics] ${name}=${value}`);
}

async function main() {
  const cmd = process.argv[2] || 'trace';
  const raw = await readStdin();

  switch (cmd) {
    case 'trace': {
      const input = parseInput(raw);
      const hookType = process.env.HOOK_TYPE || 'preToolUse';
      recordTrace(hookType, input);
      process.exit(0);
      break;
    }

    case 'metric': {
      const name = process.argv[3];
      const value = parseFloat(process.argv[4]);
      if (!name || isNaN(value)) {
        console.error('Usage: observability metric <name> <value> [tags_json]');
        process.exit(1);
      }
      const tags = process.argv[5] ? safeJsonParse(process.argv[5]) : {};
      recordMetric(name, value, tags);
      process.exit(0);
      break;
    }

    case 'health': {
      const stats = getStats();
      const healthy = stats.total_traces >= 0;
      console.log(JSON.stringify({ status: healthy ? 'ok' : 'error', stats }));
      process.exit(healthy ? 0 : 1);
      break;
    }

    case 'stats': {
      console.log(JSON.stringify(getStats(), null, 2));
      process.exit(0);
      break;
    }

    case 'search': {
      const name = process.argv[3] || '';
      const limit = parseInt(process.argv[4] || '20', 10);
      const results = searchTraces({ name }, limit);
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
      break;
    }

    default:
      console.error('Commands: trace | metric | health | stats | search');
      process.exit(1);
  }
}

function parseInput(raw) {
  try { return JSON.parse(raw || '{}'); }
  catch { return {}; }
}

function safeJsonParse(s) {
  try { return JSON.parse(s); }
  catch { return {}; }
}

function getStats() {
  try {
    ensureDir();
    if (!fs.existsSync(TRACE_LOG)) return { total_traces: 0, total_metrics: 0, by_tool: {} };
    const raw = fs.readFileSync(TRACE_LOG, 'utf8').trim();
    const metricRaw = fs.existsSync(METRICS_LOG) ? fs.readFileSync(METRICS_LOG, 'utf8').trim() : '';
    const traces = raw ? raw.split('\n').filter(Boolean) : [];
    const metrics = metricRaw ? metricRaw.split('\n').filter(Boolean) : [];
    const byTool = {};
    for (const line of traces) {
      try {
        const t = JSON.parse(line);
        const tool = t.tool || 'unknown';
        byTool[tool] = (byTool[tool] || 0) + 1;
      } catch {}
    }
    return {
      total_traces: traces.length,
      total_metrics: metrics.length,
      by_tool: byTool,
      last_updated: new Date().toISOString()
    };
  } catch {
    return { total_traces: 0, total_metrics: 0, by_tool: {} };
  }
}

function searchTraces(query, limit) {
  try {
    ensureDir();
    if (!fs.existsSync(TRACE_LOG)) return [];
    const raw = fs.readFileSync(TRACE_LOG, 'utf8').trim();
    if (!raw) return [];
    const lines = raw.split('\n').filter(Boolean);
    const results = [];
    for (let i = lines.length - 1; i >= 0 && results.length < limit; i--) {
      try {
        const t = JSON.parse(lines[i]);
        if (query.name && !t.tool?.includes(query.name) && !t.name?.includes(query.name)) continue;
        results.push(t);
      } catch {}
    }
    return results;
  } catch {
    return [];
  }
}

main().catch(err => {
  console.error(`[observability] Fatal: ${err.message}`);
  process.exit(1);
});
