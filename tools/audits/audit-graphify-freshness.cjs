#!/usr/bin/env node

/**
 * Graphify Freshness & Integrity Auditor
 *
 * Verifies that local Graphify artifacts exist and meet minimum structural
 * thresholds for Arch-System:
 *   1. graphify-out/graph.json exists and parses as valid JSON
 *   2. graphify-out/GRAPH_REPORT.md exists
 *   3. graphify-out/reflections/LESSONS.md exists
 *   4. graph.json contains >= 20,000 nodes and >= 30,000 edges
 *
 * Usage:
 *   node tools/audits/audit-graphify-freshness.cjs
 *   node tools/audits/audit-graphify-freshness.cjs --warn-only
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const GRAPH_DIR = path.join(ROOT, 'graphify-out');
const GRAPH_JSON_PATH = path.join(GRAPH_DIR, 'graph.json');
const GRAPH_REPORT_PATH = path.join(GRAPH_DIR, 'GRAPH_REPORT.md');
const LESSONS_PATH = path.join(GRAPH_DIR, 'reflections', 'LESSONS.md');

const MIN_NODES = 20_000;
const MIN_EDGES = 30_000;
const IS_WARN_ONLY = process.argv.includes('--warn-only');

const REQUIRED_FILES = [
  { label: 'graphify-out/graph.json', filePath: GRAPH_JSON_PATH },
  { label: 'graphify-out/GRAPH_REPORT.md', filePath: GRAPH_REPORT_PATH },
  { label: 'graphify-out/reflections/LESSONS.md', filePath: LESSONS_PATH },
];

function runAudit() {
  const failures = [];

  for (const entry of REQUIRED_FILES) {
    if (!fs.existsSync(entry.filePath)) {
      failures.push(`Missing required artifact: ${entry.label}`);
    }
  }

  let nodeCount = 0;
  let edgeCount = 0;

  if (fs.existsSync(GRAPH_JSON_PATH)) {
    try {
      const raw = fs.readFileSync(GRAPH_JSON_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
      const edges = Array.isArray(parsed.links)
        ? parsed.links
        : Array.isArray(parsed.edges)
          ? parsed.edges
          : [];

      nodeCount = nodes.length;
      edgeCount = edges.length;

      if (nodeCount < MIN_NODES) {
        failures.push(`Node count ${nodeCount} is below minimum threshold ${MIN_NODES}.`);
      }
      if (edgeCount < MIN_EDGES) {
        failures.push(`Edge count ${edgeCount} is below minimum threshold ${MIN_EDGES}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`Failed to parse graphify-out/graph.json: ${message}`);
    }
  }

  console.log('\nGraphify Freshness & Integrity Audit');
  console.log('------------------------------------');
  console.log(`Nodes : ${nodeCount} (min ${MIN_NODES})`);
  console.log(`Edges : ${edgeCount} (min ${MIN_EDGES})`);

  if (failures.length === 0) {
    console.log('Status: PASS\n');
    return 0;
  }

  console.log(`Status: ${IS_WARN_ONLY ? 'WARN (warn-only mode)' : 'FAIL'}`);
  for (const failure of failures) {
    console.log(`  - ${failure}`);
  }
  console.log('');

  return IS_WARN_ONLY ? 0 : 1;
}

process.exit(runAudit());
