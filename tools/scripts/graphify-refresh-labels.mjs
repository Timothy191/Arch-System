#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const GRAPH_PATH = path.join(WORKSPACE_ROOT, 'graphify-out', 'graph.json');
const LABELS_PATH = path.join(WORKSPACE_ROOT, 'graphify-out', '.graphify_labels.json');

const GENERIC_FILENAMES = new Set([
  'index.ts',
  'index.tsx',
  'index.js',
  'index.mjs',
  'index.cjs',
  'index.md',
  'package.json',
  'tsconfig.json',
  'readme.md',
]);

/**
 * Determine whether an existing label is missing, numeric, or a generic hub fallback.
 * @param {unknown} rawLabel
 * @param {string} communityId
 * @returns {boolean}
 */
function isGenericOrMissingLabel(rawLabel, communityId) {
  if (typeof rawLabel !== 'string') {
    return true;
  }
  const trimmed = rawLabel.trim();
  if (trimmed.length === 0 || trimmed === communityId) {
    return true;
  }
  if (/^\d+$/.test(trimmed)) {
    return true;
  }
  if (/^(?:community|cluster|group)[_\s-]?\d*$/i.test(trimmed)) {
    return true;
  }
  if (trimmed.startsWith('ref_')) {
    return true;
  }
  return GENERIC_FILENAMES.has(trimmed.toLowerCase());
}

/**
 * Extract a normalized domain directory prefix from a node's source_file path.
 * @param {unknown} sourceFile
 * @returns {string}
 */
function extractDomainPrefix(sourceFile) {
  if (typeof sourceFile !== 'string' || sourceFile.trim().length === 0) {
    return 'root';
  }
  const normalized = sourceFile.replaceAll('\\', '/').replace(/^\.\//, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) {
    return 'root';
  }

  // apps/portal/app/(departments)/<dept>/...
  if (
    parts[0] === 'apps' &&
    parts[1] === 'portal' &&
    parts[2] === 'app' &&
    parts[3] === '(departments)' &&
    parts[4]
  ) {
    return `apps/portal/app/(departments)/${parts[4]}`;
  }

  // packages/<pkg>/...
  if (parts[0] === 'packages' && parts[1]) {
    return `packages/${parts[1]}`;
  }

  // libs/<slice>/...
  if (parts[0] === 'libs' && parts[1]) {
    if ((parts[1] === 'features' || parts[1] === 'shared') && parts[2]) {
      return `libs/${parts[1]}/${parts[2]}`;
    }
    return `libs/${parts[1]}`;
  }

  // tools/<tool>/...
  if (parts[0] === 'tools' && parts[1]) {
    return `tools/${parts[1]}`;
  }

  // apps/<app>/...
  if (parts[0] === 'apps' && parts[1]) {
    return `apps/${parts[1]}`;
  }

  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
}

/**
 * Derive a deterministic semantic label from a community's top directory prefix and hub node.
 * @param {Array<Record<string, unknown>>} nodes
 * @param {Map<string, number>} degreeMap
 * @returns {string}
 */
function deriveCommunityLabel(nodes, degreeMap) {
  const dirCounts = new Map();
  for (const node of nodes) {
    const prefix = extractDomainPrefix(node.source_file);
    dirCounts.set(prefix, (dirCounts.get(prefix) ?? 0) + 1);
  }

  const sortedDirs = [...dirCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });
  const topDir = sortedDirs[0]?.[0] ?? 'root';

  const sortedNodes = [...nodes].sort((a, b) => {
    const idA = String(a.id ?? '');
    const idB = String(b.id ?? '');
    const degA = degreeMap.get(idA) ?? 0;
    const degB = degreeMap.get(idB) ?? 0;
    if (degB !== degA) {
      return degB - degA;
    }
    const labelA = String(a.label ?? idA);
    const labelB = String(b.label ?? idB);
    const cmp = labelA.localeCompare(labelB);
    return cmp !== 0 ? cmp : idA.localeCompare(idB);
  });

  const hubNode = sortedNodes[0];
  const hubLabel = String(hubNode?.label ?? hubNode?.id ?? 'unknown').trim() || 'unknown';
  return `${topDir}: ${hubLabel}`;
}

function main() {
  if (!fs.existsSync(GRAPH_PATH)) {
    throw new Error(`Graph file not found at ${GRAPH_PATH}`);
  }

  const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const links = Array.isArray(graph.links)
    ? graph.links
    : Array.isArray(graph.edges)
      ? graph.edges
      : [];

  let existingLabels = {};
  if (fs.existsSync(LABELS_PATH)) {
    existingLabels = JSON.parse(fs.readFileSync(LABELS_PATH, 'utf8'));
  }

  const degreeMap = new Map();
  for (const link of links) {
    const sourceId = String(link.source ?? '');
    const targetId = String(link.target ?? '');
    if (sourceId) {
      degreeMap.set(sourceId, (degreeMap.get(sourceId) ?? 0) + 1);
    }
    if (targetId) {
      degreeMap.set(targetId, (degreeMap.get(targetId) ?? 0) + 1);
    }
  }

  const communityNodes = new Map();
  for (const node of nodes) {
    if (node.community === undefined || node.community === null) {
      continue;
    }
    const commId = String(node.community);
    let list = communityNodes.get(commId);
    if (!list) {
      list = [];
      communityNodes.set(commId, list);
    }
    list.push(node);
  }

  const sortedCommunityIds = [...communityNodes.keys()].sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  const nextLabels = {};
  let preservedCount = 0;
  let refreshedCount = 0;

  for (const commId of sortedCommunityIds) {
    const existing = existingLabels[commId];
    if (!isGenericOrMissingLabel(existing, commId)) {
      nextLabels[commId] = existing;
      preservedCount += 1;
      continue;
    }
    const groupNodes = communityNodes.get(commId) ?? [];
    nextLabels[commId] = deriveCommunityLabel(groupNodes, degreeMap);
    refreshedCount += 1;
  }

  fs.writeFileSync(LABELS_PATH, `${JSON.stringify(nextLabels, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        total_communities: sortedCommunityIds.length,
        preserved_labels: preservedCount,
        refreshed_labels: refreshedCount,
        output_path: path.relative(WORKSPACE_ROOT, LABELS_PATH),
      },
      null,
      2
    )
  );
}

main();
