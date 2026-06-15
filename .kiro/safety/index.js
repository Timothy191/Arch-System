#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const LAYERS_DIR = path.join(PROJ, '.kiro', 'safety', 'layers');

const LAYER_ORDER = [
  '01-budget',
  '02-permission',
  '03-isolation',
  '04-content-filter',
  '05-rate-limiter',
  '06-audit-log',
  '07-user-control'
];

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

function loadPolicy() {
  const mode = process.env.SAFETY_MODE || 'default';
  const p = path.join(PROJ, '.kiro', 'safety', 'policies', `${mode}.json`);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch {
    const defaultPath = path.join(PROJ, '.kiro', 'safety', 'policies', 'default.json');
    return JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
  }
}

function getSessionId() {
  const raw = process.env.CLAUDE_SESSION_ID || String(process.ppid) || 'default';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

async function main() {
  const raw = await readStdin();
  let input = {};
  try { input = JSON.parse(raw); } catch { input = { tool: 'unknown' }; }

  const tool = (input.tool || input.tool_name || 'unknown').toString();
  const toolInput = input.tool_input || input.arguments || {};
  const toolCall = { tool, input: toolInput };
  const policy = loadPolicy();

  const results = [];
  let finalDecision = { allow: true, reason: 'All layers passed', severity: 'info', layer: 'orchestrator' };

  for (const layerName of LAYER_ORDER) {
    const layerPath = path.join(LAYERS_DIR, `${layerName}.js`);
    if (!fs.existsSync(layerPath)) continue;

    try {
      const layerFn = require(layerPath);
      const context = { policy, lastResult: finalDecision };
      const result = layerFn(toolCall, context);

      results.push(result);

      if (!result.allow) {
        finalDecision = result;
        break;
      }

      if (result.severity === 'warn' && finalDecision.severity !== 'warn') {
        finalDecision = result;
      }
    } catch (err) {
      console.error(`[safety] Layer ${layerName} error: ${err.message}`);
      results.push({ allow: true, reason: `Layer ${layerName} error (fail-open): ${err.message}`, severity: 'warn', layer: layerName });
    }
  }

  if (!finalDecision.allow) {
    console.error(`[safety] BLOCKED by ${finalDecision.layer}: ${finalDecision.reason}`);
    if (finalDecision.can_approve) {
      console.error(`[safety] To approve: edit .kiro/safety/exceptions.json`);
    }
    process.exit(2);
  }

  if (finalDecision.severity === 'warn') {
    console.error(`[safety] WARN from ${finalDecision.layer}: ${finalDecision.reason}`);
  }

  if (process.env.SAFETY_DEBUG === '1') {
    for (const r of results) {
      console.error(`[safety] ${r.layer}: ${r.allow ? 'ALLOW' : 'BLOCK'} — ${r.reason}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(`[safety] Fatal error: ${err.message}`);
  process.exit(2);
});
