#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const METRICS_FILE = path.join(PROJ, 'ltm', 'store', 'metrics.jsonl');
const TRACE_LOG = path.join(PROJ, 'ltm', 'store', 'traces.jsonl');
const PORT = parseInt(process.env.METRICS_PORT || '9464', 10);

function collectMetrics() {
  const metrics = {};

  metrics['kiro_tool_calls_total'] = countLines(TRACE_LOG);
  metrics['kiro_metric_events_total'] = countLines(METRICS_FILE);

  const lastTraces = readLastLines(TRACE_LOG, 100);
  const byTool = {};
  let errors = 0;
  for (const line of lastTraces) {
    try {
      const t = JSON.parse(line);
      const tool = t.tool || 'unknown';
      byTool[tool] = (byTool[tool] || 0) + 1;
      if (t.status === 'error' || t.status === 'failed') errors++;
    } catch {}
  }
  metrics['kiro_tool_calls_by_tool'] = byTool;

  const lastMetrics = readLastLines(METRICS_FILE, 100);
  const customMetrics = {};
  for (const line of lastMetrics) {
    try {
      const m = JSON.parse(line);
      customMetrics[m.name] = m.value;
    } catch {}
  }
  metrics['kiro_custom_metrics'] = customMetrics;
  metrics['kiro_errors_total'] = errors;

  const auditFile = path.join(PROJ, 'ltm', 'store', 'audit.jsonl');
  const blockCount = countAuditBlocks(auditFile);
  metrics['kiro_safety_blocks_total'] = blockCount;
  metrics['kiro_up_seconds'] = Math.floor((Date.now() - startTime) / 1000);

  return metrics;
}

function countLines(file) {
  try {
    if (!fs.existsSync(file)) return 0;
    return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).length;
  } catch { return 0; }
}

function countAuditBlocks(file) {
  try {
    if (!fs.existsSync(file)) return 0;
    return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
      .filter(l => l.includes('"severity":"block"') || l.includes('"action":"block"')).length;
  } catch { return 0; }
}

function readLastLines(file, n) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) return [];
    const lines = raw.split('\n').filter(Boolean);
    return lines.slice(-n);
  } catch { return []; }
}

function formatPrometheus(metrics) {
  const lines = [];
  lines.push('# HELP kiro_tool_calls_total Total tool calls made');
  lines.push('# TYPE kiro_tool_calls_total counter');
  lines.push(`kiro_tool_calls_total ${metrics['kiro_tool_calls_total']}`);

  lines.push('# HELP kiro_metric_events_total Total metric events recorded');
  lines.push('# TYPE kiro_metric_events_total counter');
  lines.push(`kiro_metric_events_total ${metrics['kiro_metric_events_total']}`);

  lines.push('# HELP kiro_errors_total Total tool call errors');
  lines.push('# TYPE kiro_errors_total counter');
  lines.push(`kiro_errors_total ${metrics['kiro_errors_total']}`);

  lines.push('# HELP kiro_safety_blocks_total Total safety blocks');
  lines.push('# TYPE kiro_safety_blocks_total counter');
  lines.push(`kiro_safety_blocks_total ${metrics['kiro_safety_blocks_total']}`);

  lines.push('# HELP kiro_up_seconds Seconds since process start');
  lines.push('# TYPE kiro_up_seconds gauge');
  lines.push(`kiro_up_seconds ${metrics['kiro_up_seconds']}`);

  if (metrics['kiro_tool_calls_by_tool']) {
    for (const [tool, count] of Object.entries(metrics['kiro_tool_calls_by_tool'])) {
      lines.push(`kiro_tool_calls_by_tool{tool="${tool}"} ${count}`);
    }
  }

  return lines.join('\n') + '\n';
}

const startTime = Date.now();
const server = http.createServer((req, res) => {
  if (req.url === '/metrics' || req.url === '/') {
    try {
      const metrics = collectMetrics();
      const output = formatPrometheus(metrics);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(output);
    } catch (err) {
      res.writeHead(500);
      res.end(`Error: ${err.message}\n`);
    }
  } else {
    res.writeHead(404);
    res.end('Not found\n');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.error(`[metrics] Prometheus endpoint at http://0.0.0.0:${PORT}/metrics`);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
