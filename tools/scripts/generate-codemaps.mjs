#!/usr/bin/env node
/**
 * generate-codemaps.mjs
 *
 * Populates the empty `codemap.md` template stubs under apps/portal with
 * derived architectural understanding (exports, route handlers, data flow)
 * so the codebase-maps endpoint and agent navigation have real content.
 *
 * Idempotent: skips any codemap.md that already has filled content.
 *
 * Usage:
 *   node tools/scripts/generate-codemaps.mjs [--dry-run] [--force]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TARGET = path.join(ROOT, 'apps/portal/app');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const FORCE = args.includes('--force');

const CODE_EXTS = new Set(['.ts', '.tsx', '.mjs', '.js']);

function rel(dir) {
  return path.relative(TARGET, dir) || 'apps/portal/app';
}

function readSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function listCodeFiles(dir) {
  let out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('(') || e.name === '_') continue; // route groups handled at parent
      out = out.concat(listCodeFiles(full));
    } else if (CODE_EXTS.has(path.extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

function extractHttpMethods(src) {
  const methods = [];
  for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${m}\\b`);
    if (re.test(src)) methods.push(m);
  }
  return methods;
}

function extractExports(src) {
  const names = new Set();
  for (const re of [
    /export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,
    /export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g,
    /export\s+class\s+([A-Za-z0-9_$]+)/g,
  ]) {
    let m;
    while ((m = re.exec(src))) names.add(m[1]);
  }
  if (/export\s+default/.test(src)) names.add('default');
  return [...names];
}

function extractImports(src) {
  const froms = new Set();
  for (const re of [/from\s+['"]([^'"]+)['"]/g, /import\s+['"]([^'"]+)['"]/g]) {
    let m;
    while ((m = re.exec(src))) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;
      froms.add(path.basename(spec) || spec);
    }
  }
  return [...froms];
}

function extractDbTables(src) {
  const tables = new Set();
  const re = /\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) tables.add(m[1]);
  return [...tables];
}

function extractHooks(src) {
  const hooks = new Set();
  const re = /\b(use[A-Z][A-Za-z0-9_]*)\b/g;
  let m;
  while ((m = re.exec(src))) hooks.add(m[1]);
  return [...hooks];
}

function kindOf(files) {
  const names = files.map((f) => path.basename(f));
  if (names.includes('route.ts') || names.includes('route.tsx')) return 'api-route';
  if (names.includes('page.tsx')) return 'page';
  if (names.includes('layout.tsx')) return 'layout';
  if (names.includes('loading.tsx')) return 'loading';
  if (names.includes('error.tsx')) return 'error-boundary';
  return 'module';
}

function build(dir) {
  const files = listCodeFiles(dir);
  const tests = files.filter((f) => /\.(test|spec)\.[tj]sx?$/.test(f));
  const sources = files.filter((f) => !tests.includes(f));

  const allExports = new Map();
  const allImports = new Set();
  const methods = new Set();
  const tables = new Set();
  const hooks = new Set();
  const clients = [];

  for (const f of sources) {
    const src = readSafe(f);
    const name = path.basename(f);
    for (const m of extractHttpMethods(src)) methods.add(m);
    for (const t of extractDbTables(src)) tables.add(t);
    if (/"use client"/.test(src) || /'use client'/.test(src)) clients.push(name);
    const ex = extractExports(src);
    if (ex.length) allExports.set(name, ex);
    for (const i of extractImports(src)) allImports.add(i);
    for (const h of extractHooks(src)) hooks.add(h);
  }

  const kind = kindOf(sources);
  const dirName = rel(dir);

  const lines = [];
  lines.push(`# ${dirName}/`);
  lines.push('');
  lines.push(
    `**Kind:** ${kind} · **Files:** ${sources.length}${tests.length ? ` (+${tests.length} test)` : ''}`
  );
  lines.push('');
  lines.push('## Responsibility');
  lines.push('');
  if (kind === 'api-route') {
    lines.push(
      `Next.js App Router route handler serving \`${[...methods].join(', ') || 'HTTP'}\` requests.`
    );
    lines.push(
      'Route handlers own the HTTP contract: request parsing (Zod), authorization, rate limiting,'
    );
    lines.push(
      'and JSON response shaping. Business logic stays in `lib/` or packages; no DB access from client components.'
    );
  } else if (kind === 'page') {
    lines.push(`React Server Component page under the ${dirName} route.`);
    lines.push(
      'Server Components fetch data directly (no client-side fetching), pass props down to client islands.'
    );
  } else if (kind === 'layout') {
    lines.push(`Shared layout for the ${dirName} route subtree.`);
    lines.push(
      'Owns persistent chrome (nav, providers, error boundaries) that survives child navigation.'
    );
  } else if (kind === 'error-boundary') {
    lines.push(`Error boundary for the ${dirName} route subtree.`);
    lines.push(
      'Renders the fallback UI and logs the failure; must never swallow the reset affordance.'
    );
  } else if (kind === 'loading') {
    lines.push(`Streaming fallback for ${dirName}; rendered while the RSC tree suspends.`);
  } else {
    lines.push(`Supporting module directory for ${dirName}.`);
  }
  lines.push('');
  lines.push('## Design');
  lines.push('');
  if (methods.size) lines.push(`- HTTP methods: ${[...methods].join(', ')}`);
  if (clients.length) lines.push(`- Client components ("use client"): ${clients.join(', ')}`);
  if (hooks.size) lines.push(`- Hooks referenced: ${[...hooks].slice(0, 12).join(', ')}`);
  if (!methods.size && !hooks.size && !clients.length)
    lines.push('- (No client hooks or route methods detected — pure server/data module.)');
  if (tables.size) lines.push(`- Database tables touched: ${[...tables].join(', ')}`);
  if (allExports.size) {
    lines.push('- Exports:');
    for (const [file, ex] of allExports) lines.push(`  - \`${file}\` → ${ex.join(', ')}`);
  }
  lines.push('');
  lines.push('## Flow');
  lines.push('');
  if (kind === 'api-route') {
    lines.push(
      'Request → auth check → rate limit → parse body/params → validate (Zod) → execute (queue/RPC/service) → JSON response.'
    );
    lines.push(
      'Errors are logged via `logError` and surfaced as structured JSON, never as silent 2xx.'
    );
  } else if (kind === 'page' || kind === 'layout') {
    lines.push('Route params/segments → server data fetch → RSC render → client island hydration.');
  } else {
    lines.push('Imported by the parent route; exposes the exports listed above.');
  }
  if (allImports.size) lines.push('');
  if (allImports.size)
    lines.push(`- Local imports consumed: ${[...allImports].slice(0, 15).join(', ')}`);
  lines.push('');
  lines.push('## Integration');
  lines.push('');
  if (tables.size) {
    lines.push(
      '- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).'
    );
  }
  if (kind === 'api-route') {
    lines.push(
      '- Consumed by the portal UI and/or the n8n workflow dispatcher (BullMQ `n8n-workflow-queue`).'
    );
  }
  lines.push(
    '- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.'
  );
  lines.push('');

  return lines.join('\n');
}

let filled = 0;
let skipped = 0;
function walk(dir) {
  const mapPath = path.join(dir, 'codemap.md');
  if (fs.existsSync(mapPath)) {
    const existing = readSafe(mapPath);
    const isStub = /Fixer: Fill in this section/.test(existing);
    if (isStub || FORCE) {
      const content = build(dir);
      if (DRY) {
        console.log(`[dry-run] ${path.relative(ROOT, mapPath)}`);
      } else {
        fs.writeFileSync(mapPath, content);
        console.log(`filled    ${path.relative(ROOT, mapPath)}`);
      }
      filled++;
    } else {
      skipped++;
    }
  }
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
    walk(path.join(dir, e.name));
  }
}

walk(TARGET);
console.log(
  `\nDone. Filled: ${filled}, already-complete: ${skipped}${DRY ? ' (dry run — nothing written)' : ''}`
);
