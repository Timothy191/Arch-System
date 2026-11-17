#!/usr/bin/env node
/**
 * Idempotently indexes CSS and OKLCH design-token files into graphify-out/graph.json.
 *
 * Scans:
 *   - packages/theme/**\/*.css
 *   - packages/ui/**\/*.css
 *   - apps/portal/**\/*.css
 * Excludes: node_modules, .next, dist, coverage, .turbo, .git
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const GRAPH_PATH = path.join(REPO_ROOT, 'graphify-out', 'graph.json');

const SCAN_ROOTS = ['packages/theme', 'packages/ui', 'apps/portal'];
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', '.git']);
const ORIGIN_TAG = 'css-indexer';
const SAMPLE_TOKEN_LIMIT = 25;

const PACKAGE_IMPORT_MAP = new Map([
  ['@repo/theme/css', 'packages/theme/src/css/index.css'],
  ['@repo/ui/globals.css', 'packages/ui/src/globals.css'],
  ['@repo/ui/accessibility.css', 'packages/ui/src/accessibility.css'],
]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function makeCssNodeId(relPosixPath) {
  const sanitized = relPosixPath.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `css_${sanitized}`;
}

function collectCssFiles(dirAbs, results) {
  if (!fs.existsSync(dirAbs)) {
    return;
  }
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      collectCssFiles(fullPath, results);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.css')) {
      results.push(toPosixPath(path.relative(REPO_ROOT, fullPath)));
    }
  }
}

function resolveImportTarget(fromRelPosix, specifier, knownFilesSet) {
  if (PACKAGE_IMPORT_MAP.has(specifier)) {
    const mapped = PACKAGE_IMPORT_MAP.get(specifier);
    return knownFilesSet.has(mapped) ? mapped : null;
  }
  if (!specifier.startsWith('.')) {
    return null;
  }
  const fromDir = path.posix.dirname(fromRelPosix);
  const resolved = path.posix.normalize(path.posix.join(fromDir, specifier));
  return knownFilesSet.has(resolved) ? resolved : null;
}

function parseCssFile(relPosixPath, knownFilesSet) {
  const absPath = path.join(REPO_ROOT, relPosixPath);
  const content = fs.readFileSync(absPath, 'utf8');
  const lines = content.split(/\r?\n/);

  const imports = [];
  const tokenSet = new Set();
  let tokenDeclarations = 0;
  let atThemeCount = 0;
  let oklchCount = 0;

  const importRegex = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?/;
  const tokenDeclRegex = /(?:^|[;{\s])(--[a-zA-Z0-9_-]+)\s*:/g;
  const atThemeRegex = /@theme\b/g;
  const oklchRegex = /\boklch\s*\(/g;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    const importMatch = importRegex.exec(line);
    if (importMatch) {
      const specifier = importMatch[1];
      const targetRel = resolveImportTarget(relPosixPath, specifier, knownFilesSet);
      if (targetRel) {
        imports.push({ targetRel, lineNumber, specifier });
      }
    }

    for (const match of line.matchAll(tokenDeclRegex)) {
      tokenSet.add(match[1]);
      tokenDeclarations += 1;
    }

    const themeMatches = line.match(atThemeRegex);
    if (themeMatches) {
      atThemeCount += themeMatches.length;
    }

    const oklchMatches = line.match(oklchRegex);
    if (oklchMatches) {
      oklchCount += oklchMatches.length;
    }
  }

  const uniqueTokens = [...tokenSet];
  const baseName = path.posix.basename(relPosixPath);
  const nodeId = makeCssNodeId(relPosixPath);

  const node = {
    id: nodeId,
    label: baseName,
    _origin: ORIGIN_TAG,
    file_type: 'css',
    metadata: {
      has_at_theme: atThemeCount > 0,
      at_theme_count: atThemeCount,
      custom_property_count: uniqueTokens.length,
      custom_property_declarations: tokenDeclarations,
      custom_properties_sample: uniqueTokens.slice(0, SAMPLE_TOKEN_LIMIT),
      oklch_count: oklchCount,
      import_count: imports.length,
      line_count: lines.length,
    },
    norm_label: baseName.toLowerCase(),
    source_file: relPosixPath,
    source_location: 'L1',
  };

  const links = imports.map((imp) => ({
    source: nodeId,
    target: makeCssNodeId(imp.targetRel),
    relation: 'imports',
    _origin: ORIGIN_TAG,
    confidence: 'EXTRACTED',
    confidence_score: 1,
    source_file: relPosixPath,
    source_location: `L${imp.lineNumber}`,
    weight: 1,
  }));

  return {
    node,
    links,
    uniqueTokens,
    tokenDeclarations,
    atThemeCount,
    oklchCount,
  };
}

function main() {
  if (!fs.existsSync(GRAPH_PATH)) {
    throw new Error(`Graph file not found at ${GRAPH_PATH}`);
  }

  const cssFiles = [];
  for (const root of SCAN_ROOTS) {
    collectCssFiles(path.join(REPO_ROOT, root), cssFiles);
  }
  cssFiles.sort();

  const knownFilesSet = new Set(cssFiles);
  const cssNodes = [];
  const cssLinks = [];
  const allUniqueTokens = new Set();
  let totalTokenDeclarations = 0;
  let totalAtTheme = 0;
  let totalOklch = 0;

  for (const relPath of cssFiles) {
    const parsed = parseCssFile(relPath, knownFilesSet);
    cssNodes.push(parsed.node);
    cssLinks.push(...parsed.links);
    for (const token of parsed.uniqueTokens) {
      allUniqueTokens.add(token);
    }
    totalTokenDeclarations += parsed.tokenDeclarations;
    totalAtTheme += parsed.atThemeCount;
    totalOklch += parsed.oklchCount;
  }

  const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
  const existingNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const existingLinks = Array.isArray(graph.links) ? graph.links : [];

  const preservedNodes = existingNodes.filter(
    (node) => node.file_type !== 'css' && !String(node.id).startsWith('css_')
  );
  const preservedLinks = existingLinks.filter(
    (link) =>
      link._origin !== ORIGIN_TAG &&
      !(String(link.source).startsWith('css_') && String(link.target).startsWith('css_'))
  );

  graph.nodes = [...preservedNodes, ...cssNodes];
  graph.links = [...preservedLinks, ...cssLinks];

  fs.writeFileSync(GRAPH_PATH, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');

  const summary = {
    css_files: cssNodes.length,
    import_edges: cssLinks.length,
    unique_custom_properties: allUniqueTokens.size,
    total_custom_property_declarations: totalTokenDeclarations,
    at_theme_directives: totalAtTheme,
    oklch_usages: totalOklch,
    preserved_nodes: preservedNodes.length,
    preserved_links: preservedLinks.length,
    total_nodes: graph.nodes.length,
    total_links: graph.links.length,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
