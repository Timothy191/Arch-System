#!/usr/bin/env node

/**
 * @fileoverview Detects circular dependencies within the monorepo packages and apps.
 * Usage: node tools/circular-dep-detect.cjs
 */
//
// Detect circular dependencies in the Nx project graph.
//
// Walks apps/*/project.json and pkgs/*/project.json, follows
// workspace:* dependencies, and prints any cycle found. Exits non-zero
// on cycles (CI gate).
//
// Usage: node tools/circular-dep-detect.cjs
//        pnpm nx run graph:no-cycles (after wiring in tools/nx-plugins/)
//

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

/**
 * Reads dependencies of a project and filters workspace dependencies.
 *
 * @param {string} projectPath - The relative path of the project from the root (e.g. 'apps/portal')
 * @returns {string[]} An array of package names this project depends on via workspace:*
 */
function readDeps(projectPath) {
  const pkgPath = path.join(ROOT, projectPath, "package.json");
  if (!fs.existsSync(pkgPath)) return [];
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const deps = pkg.dependencies || {};
  const result = [];
  for (const [name, version] of Object.entries(deps)) {
    if (typeof version !== "string") continue;
    if (!version.startsWith("workspace:")) continue;
    result.push(name);
  }
  return result;
}

/**
 * Builds the dependency graph of all applications and packages.
 *
 * @returns {Map<string, string[]>} A map where keys are project names and values are their workspace dependencies.
 */
function buildGraph() {
  const graph = new Map();
  const dirs = ["apps", "pkgs", "libs/features", "libs/shared"];
  for (const dir of dirs) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    if (dir.startsWith("libs/")) {
      const layer = dir.split("/").pop();
      const parent = path.join(ROOT, "libs", layer);
      for (const group of fs.readdirSync(parent)) {
        const groupDir = path.join(parent, group);
        if (!fs.statSync(groupDir).isDirectory()) continue;
        if (layer === "features") {
          for (const layerName of fs.readdirSync(groupDir)) {
            const layerDir = path.join(groupDir, layerName);
            if (!fs.statSync(layerDir).isDirectory()) continue;
            const projectPath = path.join("libs", "features", group, layerName);
            registerProject(graph, projectPath);
          }
        } else {
          const projectPath = path.join("libs", "shared", group);
          registerProject(graph, projectPath);
        }
      }
      continue;
    }
    for (const n of fs.readdirSync(abs)) {
      const projectPath = path.join(dir, n);
      registerProject(graph, projectPath);
    }
  }
  return graph;
}

function registerProject(graph, projectPath) {
  const pkgPath = path.join(ROOT, projectPath, "package.json");
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const name = pkg.name;
  const deps = readDeps(projectPath);
  graph.set(name, deps);
}

/**
 * Finds all circular dependencies in the given project dependency graph using Depth-First Search.
 *
 * @param {Map<string, string[]>} graph - The dependency graph map.
 * @returns {string[][]} An array of cycles, where each cycle is represented as an array of package names.
 */
function findCycles(graph) {
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map();
  for (const k of graph.keys()) color.set(k, WHITE);
  const cycles = [];

  /**
   * Helper DFS function to traverse nodes and detect cycles.
   *
   * @param {string} node - Current node name.
   * @param {string[]} stack - Traversal stack to track the current path.
   */
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
  console.log("OK No circular dependencies found across " + graph.size + " projects.");
  process.exit(0);
}

console.error("FAIL " + cycles.length + " circular dependency cycle(s) detected:\n");
for (const cycle of cycles) {
  console.error("  " + cycle.join(" -> "));
}
process.exit(1);
