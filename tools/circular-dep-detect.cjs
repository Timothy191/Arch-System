#!/usr/bin/env node
//
// Detect circular dependencies in the Nx project graph.
//
// Walks apps/*/project.json and packages/*/project.json, follows
// workspace:* dependencies, and prints any cycle found. Exits non-zero
// on cycles (CI gate).
//
// Usage: node tools/circular-dep-detect.cjs
//        pnpm nx run graph:no-cycles (after wiring in tools/nx-plugins/)
//

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readDeps(projectPath) {
  const pkgPath = path.join(ROOT, projectPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = pkg.dependencies || {};
  const result = [];
  for (const [name, version] of Object.entries(deps)) {
    if (typeof version !== 'string') continue;
    if (!version.startsWith('workspace:')) continue;
    result.push(name);
  }
  return result;
}

function buildGraph() {
  const graph = new Map();
  const dirs = ['apps', 'packages'];
  for (const dir of dirs) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const n of fs.readdirSync(abs)) {
      const projectPath = path.join(dir, n);
      const pkgPath = path.join(ROOT, projectPath, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const name = pkg.name;
      const deps = readDeps(projectPath);
      graph.set(name, deps);
    }
  }
  return graph;
}

function findCycles(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const k of graph.keys()) color.set(k, WHITE);
  const cycles = [];

  function dfs(node, stack) {
    color.set(node, GRAY);
    stack.push(node);
    const deps = graph.get(node) || [];
    for (const dep of deps) {
      if (!graph.has(dep)) continue;
      const c = color.get(dep);
      if (c === GRAY) {
        const idx = stack.indexOf(dep);
        cycles.push(stack.slice(idx).concat(dep));
      } else if (c === WHITE) {
        dfs(dep, stack);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) dfs(node, []);
  }
  return cycles;
}

const graph = buildGraph();
const cycles = findCycles(graph);

if (cycles.length === 0) {
  console.log('OK No circular dependencies found across ' + graph.size + ' projects.');
  process.exit(0);
}

console.error('FAIL ' + cycles.length + ' circular dependency cycle(s) detected:\n');
for (const cycle of cycles) {
  console.error('  ' + cycle.join(' -> '));
}
process.exit(1);
