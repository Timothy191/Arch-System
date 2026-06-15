#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const STORE = path.join(PROJ, 'ltm', 'store', 'context.jsonl');

const STAGES = [
  { name: 'trim-history', weight: 1, min: 10 },   
  { name: 'deduplicate', weight: 2, min: 0 },      
  { name: 'summarize', weight: 3, min: 1 },         
  { name: 'prune-tool-output', weight: 4, min: 1 }, 
  { name: 'prioritize-recent', weight: 5, min: 5 }  
];

function readInput() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data || '{"entries":[]}')); }
      catch { resolve({ entries: [] }); }
    });
  });
}

function estimateTokens(obj) {
  return Math.ceil(JSON.stringify(obj).length / 4);
}

function compress(entries, targetTokens) {
  let current = [...entries];
  let stage = 0;
  const stagesApplied = [];
  const originalTokens = estimateTokens(entries);
  const originalCount = entries.length;

  while (estimateTokens(current) > targetTokens && stage < STAGES.length) {
    const s = STAGES[stage];
    const before = current.length;
    const beforeTokens = estimateTokens(current);

    switch (s.name) {
      case 'trim-history': {
        current.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        const keep = Math.max(s.min, Math.ceil(current.length / 2));
        current = current.slice(0, keep);
        break;
      }
      case 'deduplicate': {
        const seen = new Set();
        current = current.filter(e => {
          const key = JSON.stringify({ tool: e.tool, action: e.action || e.name });
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        break;
      }
      case 'summarize': {
        const groups = {};
        for (const e of current) {
          const grp = e.tool || e.type || 'other';
          if (!groups[grp]) groups[grp] = [];
          groups[grp].push(e);
        }
        current = Object.entries(groups).map(([tool, entries]) => ({
          tool,
          count: entries.length,
          summary: `[${tool}] ${entries.length} calls collapsed`,
          timestamp: entries[entries.length - 1]?.timestamp,
          collapsed: true
        }));
        break;
      }
      case 'prune-tool-output': {
        current = current.map(e => {
          if (e.output && typeof e.output === 'string' && e.output.length > 500) {
            return { ...e, output: e.output.slice(0, 500) + '...[truncated]' };
          }
          if (e.result && typeof e.result === 'string' && e.result.length > 500) {
            return { ...e, result: e.result.slice(0, 500) + '...[truncated]' };
          }
          return e;
        });
        break;
      }
      case 'prioritize-recent': {
        const sorted = [...current].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        const recent = sorted.slice(0, Math.max(s.min, Math.ceil(current.length * 0.3)));
        const rest = sorted.slice(recent.length);
        const errors = rest.filter(e => e.status === 'error' || e.status === 'failed');
        current = [...recent, ...errors];
        break;
      }
    }

    const afterTokens = estimateTokens(current);
    stagesApplied.push({
      stage: s.name,
      before: { count: before, tokens: beforeTokens },
      after: { count: current.length, tokens: afterTokens },
      saved: beforeTokens - afterTokens
    });
    stage++;
  }

  return {
    original: { count: originalCount, tokens: originalTokens },
    compressed: { count: current.length, tokens: estimateTokens(current) },
    stages_applied: stagesApplied,
    entries: current
  };
}

if (require.main === module) {
  (async () => {
    const targetTokens = parseInt(process.argv[2] || '8000', 10);
    const input = await readInput();
    const result = compress(input.entries || [], targetTokens);
    console.log(JSON.stringify(result, null, 2));
  })().catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
}

module.exports = { compress, STAGES, estimateTokens };
