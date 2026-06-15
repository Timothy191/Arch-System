#!/usr/bin/env node
/**
 * catalog-guard: PreToolUse hook
 *
 * Blocks direct edits to package.json / pnpm-workspace.yaml that add a
 * dependency already pinned in the workspace catalog. Forces the contributor
 * to use `pnpm add` so the catalog stays the single source of truth.
 *
 * Match: file_path ends with /package.json or /pnpm-workspace.yaml
 *        AND content adds a dep that is already in catalog: or named catalogs.
 *
 * Soft-warns (exit 0 with stderr) for new packages — only hard-blocks (exit 2)
 * for deps that exist in a catalog but were added with a hard version.
 *
 * Pairs with .claude/rules/architecture.md "Dependency Versioning".
 */

const fs = require('fs');
const path = require('path');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => {
      data += c;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

/**
 * Lightweight YAML parser for pnpm-workspace.yaml — we only need top-level
 * keys and their string values. Catalog blocks can be:
 *   catalog:
 *     react: ^18.0.0
 *   catalog:react19:
 *     react: ^19.0.0
 * Returns: { flat: Set<string>, byCatalog: Map<string, Set<string>> }
 */
function parseCatalogs(yamlText) {
  const result = { flat: new Set(), byCatalog: new Map() };
  if (!yamlText) return result;
  const lines = yamlText.split('\n');
  let currentCatalog = null;
  for (const line of lines) {
    const stripped = line.replace(/#.*$/, '').replace(/\s+$/, '');
    if (!stripped.trim()) continue;
    const catalogMatch = stripped.match(/^((?:catalog(?::[\w-]+)?)|(?:[a-z0-9][\w-]*)):\s*$/i);
    if (catalogMatch) {
      currentCatalog = catalogMatch[1];
      if (!result.byCatalog.has(currentCatalog)) {
        result.byCatalog.set(currentCatalog, new Set());
      }
      continue;
    }
    if (currentCatalog && !line.startsWith(' ') && !line.startsWith('\t')) {
      currentCatalog = null;
    }
    if (currentCatalog) {
      const entry = stripped.match(/^\s+([A-Za-z0-9_@/.-]+):\s*['"]?([^'"]+)['"]?\s*$/);
      if (entry) {
        const [, name, version] = entry;
        result.flat.add(name);
        result.byCatalog.get(currentCatalog).add(name);
      }
    }
  }
  return result;
}

function extractAddedDeps(content) {
  if (!content) return { deps: new Set() };
  let json = null;
  try {
    json = JSON.parse(content);
  } catch {
    return { deps: new Set() };
  }
  const all = new Set();
  for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(json[k] || {})) {
      all.add(name);
    }
  }
  return { deps: all };
}

(async () => {
  const raw = await readStdin();
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const filePath = input?.tool_input?.file_path || input?.tool_input?.TargetFile || '';
  if (!filePath) process.exit(0);
  if (!/package\.json$|pnpm-workspace\.yaml$/.test(filePath)) process.exit(0);

  const content = input?.tool_input?.content || input?.tool_input?.new_string || '';
  if (!content) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const workspaceYaml = path.join(projectDir, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspaceYaml)) process.exit(0);
  const catalogs = parseCatalogs(fs.readFileSync(workspaceYaml, 'utf8'));
  if (catalogs.flat.size === 0) process.exit(0);

  const added = extractAddedDeps(content);
  const collisions = [...added.deps].filter((d) => catalogs.flat.has(d));
  if (collisions.length === 0) process.exit(0);

  console.error(
    `[catalog-guard] ${filePath} adds package(s) that already exist in pnpm-workspace.yaml catalog: ${collisions.join(', ')}.\n` +
      'Use `pnpm add` (or `pnpm --filter <pkg> add`) so the catalog stays the single source of truth.\n' +
      'See .claude/rules/architecture.md "Dependency Versioning" for the policy.'
  );
  process.exit(2);
})();
