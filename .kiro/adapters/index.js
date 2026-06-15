#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const CONFIG = path.join(PROJ, '.kiro', 'adapters', 'config.json');
const VENV = path.join(PROJ, 'ltm', '.venv', 'bin', 'python3');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); }
  catch { return { active_provider: 'jsonl', providers: {} }; }
}

function getActive() {
  const config = loadConfig();
  const name = config.active_provider || 'jsonl';
  return { name, config: config.providers[name] || {}, full: config };
}

async function query(text, topK = 5) {
  const active = getActive();
  switch (active.name) {
    case 'jsonl':
      return queryJsonl(text, topK);
    case 'qdrant':
      return queryQdrant(text, topK, active.config);
    case 'chroma':
      return queryChroma(text, topK, active.config);
    default:
      return queryJsonl(text, topK);
  }
}

async function ingest(items) {
  const active = getActive();
  switch (active.name) {
    case 'jsonl':
      return ingestJsonl(items);
    case 'qdrant':
      return ingestQdrant(items, active.config);
    case 'chroma':
      return ingestChroma(items, active.config);
    default:
      return ingestJsonl(items);
  }
}

function queryJsonl(text, topK) {
  const storePath = path.join(PROJ, 'ltm', 'store', 'vectors.jsonl');
  if (!fs.existsSync(storePath)) return { results: [], provider: 'jsonl' };
  const lines = fs.readFileSync(storePath, 'utf8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return { results: [], provider: 'jsonl' };

  const queryWords = text.toLowerCase().split(/\s+/);
  const scored = lines.map((line, idx) => {
    try {
      const entry = JSON.parse(line);
      const text = (entry.text || entry.content || '').toLowerCase();
      const words = text.split(/\s+/);
      let score = 0;
      for (const qw of queryWords) {
        if (words.includes(qw)) score += 1;
      }
      score = score / Math.max(queryWords.length, 1);
      return { entry, score, index: idx };
    } catch { return null; }
  }).filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK).map(s => ({
    text: s.entry.text || s.entry.content || '',
    metadata: s.entry.metadata || {},
    score: s.score
  }));

  return { results, provider: 'jsonl' };
}

async function queryQdrant(text, topK, cfg) {
  try {
    const res = await fetch(`${cfg.url}/collections/${cfg.collection}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector: await embed(text),
        limit: topK,
        with_payload: true
      }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error(`Qdrant ${res.status}`);
    const data = await res.json();
    return {
      results: (data.result || []).map(r => ({
        text: r.payload?.text || '',
        metadata: r.payload || {},
        score: r.score || 0
      })),
      provider: 'qdrant'
    };
  } catch (err) {
    console.error(`[adapter] Qdrant error: ${err.message}. Falling back to jsonl.`);
    return queryJsonl(text, topK);
  }
}

async function queryChroma(text, topK, cfg) {
  try {
    const res = await fetch(`${cfg.url}/api/v1/collections/${cfg.collection}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_texts: [text],
        n_results: topK
      }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error(`Chroma ${res.status}`);
    const data = await res.json();
    return {
      results: (data.documents?.[0] || []).map((doc, i) => ({
        text: doc,
        metadata: (data.metadatas?.[0] || [])[i] || {},
        score: (data.distances?.[0] || [])[i] ? 1 - (data.distances[0][i] || 0) : 0
      })),
      provider: 'chroma'
    };
  } catch (err) {
    console.error(`[adapter] Chroma error: ${err.message}. Falling back to jsonl.`);
    return queryJsonl(text, topK);
  }
}

function ingestJsonl(items) {
  const storePath = path.join(PROJ, 'ltm', 'store', 'vectors.jsonl');
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let count = 0;
  for (const item of (Array.isArray(items) ? items : [items])) {
    fs.appendFileSync(storePath, JSON.stringify({
      text: item.text || item.content || '',
      metadata: item.metadata || {},
      timestamp: new Date().toISOString()
    }) + '\n');
    count++;
  }
  return { ingested: count, provider: 'jsonl' };
}

async function ingestQdrant(items, cfg) {
  try {
    const batch = Array.isArray(items) ? items : [items];
    const points = [];
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      points.push({
        id: Date.now() + i,
        vector: await embed(item.text || item.content || ''),
        payload: { text: item.text || item.content || '', metadata: item.metadata || {} }
      });
    }
    const res = await fetch(`${cfg.url}/collections/${cfg.collection}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error(`Qdrant ${res.status}`);
    return { ingested: points.length, provider: 'qdrant' };
  } catch (err) {
    console.error(`[adapter] Qdrant ingest error: ${err.message}. Falling back to jsonl.`);
    return ingestJsonl(items);
  }
}

async function ingestChroma(items, cfg) {
  try {
    const batch = Array.isArray(items) ? items : [items];
    const ids = batch.map((_, i) => `id_${Date.now()}_${i}`);
    const texts = batch.map(i => i.text || i.content || '');
    const metadatas = batch.map(i => i.metadata || {});
    const res = await fetch(`${cfg.url}/api/v1/collections/${cfg.collection}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, documents: texts, metadatas }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error(`Chroma ${res.status}`);
    return { ingested: batch.length, provider: 'chroma' };
  } catch (err) {
    console.error(`[adapter] Chroma ingest error: ${err.message}. Falling back to jsonl.`);
    return ingestJsonl(items);
  }
}

async function embed(text) {
  const result = spawnSync(VENV, [
    path.join(PROJ, 'ltm', 'bin', 'vector.py'), 'embed', text
  ], { timeout: 10000, encoding: 'utf8' });
  if (result.status === 0) {
    try { return JSON.parse(result.stdout.trim()).vector; } catch {}
  }
  return new Array(384).fill(0).map(() => Math.random() * 0.01);
}

async function status() {
  const active = getActive();
  const results = { active_provider: active.name, providers: {} };
  for (const [name, cfg] of Object.entries(active.full.providers)) {
    try {
      if (cfg.type === 'jsonl') {
        const p = cfg.path || 'ltm/store/vectors.jsonl';
        const fullPath = p.startsWith('/') ? p : path.join(PROJ, p);
        results.providers[name] = fs.existsSync(fullPath)
          ? { status: 'ok', count: fs.readFileSync(fullPath, 'utf8').trim().split('\n').filter(Boolean).length }
          : { status: 'ok', count: 0 };
      } else if (cfg.type === 'qdrant') {
        const res = await fetch(`${cfg.url}/collections/${cfg.collection}`, { signal: AbortSignal.timeout(3000) });
        results.providers[name] = res.ok ? { status: 'ok' } : { status: 'error', error: `${res.status}` };
      } else if (cfg.type === 'chroma') {
        const res = await fetch(`${cfg.url}/api/v1/collections/${cfg.collection}`, { signal: AbortSignal.timeout(3000) });
        results.providers[name] = res.ok ? { status: 'ok' } : { status: 'error', error: `${res.status}` };
      }
    } catch (err) {
      results.providers[name] = { status: 'error', error: err.message };
    }
  }
  return results;
}

if (require.main === module) {
  const cmd = process.argv[2] || 'status';
  (async () => {
    switch (cmd) {
      case 'query': {
        const text = process.argv[3] || '';
        const topK = parseInt(process.argv[4] || '5', 10);
        const result = await query(text, topK);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'ingest': {
        const input = fs.readFileSync('/dev/stdin', 'utf8').trim();
        const items = input ? JSON.parse(input) : [];
        const result = await ingest(items);
        console.log(JSON.stringify(result));
        break;
      }
      case 'status': {
        const s = await status();
        console.log(JSON.stringify(s, null, 2));
        break;
      }
      case 'switch': {
        const provider = process.argv[3];
        const config = loadConfig();
        if (config.providers[provider]) {
          config.active_provider = provider;
          fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2));
          console.log(JSON.stringify({ status: 'ok', active: provider }));
        } else {
          console.log(JSON.stringify({ status: 'error', error: `Unknown provider: ${provider}` }));
        }
        break;
      }
      default:
        console.log('Commands: query <text> [topK] | ingest (stdin) | status | switch <provider>');
    }
  })().catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
}

module.exports = { query, ingest, status, loadConfig };
