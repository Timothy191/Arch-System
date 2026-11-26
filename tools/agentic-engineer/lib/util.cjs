'use strict';

/**
 * Shared filesystem, JSON, hashing, and frontmatter helpers for the
 * Agentic Engineer control plane.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const IGNORED_WALK_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function relative(root, target) {
  return toPosix(path.relative(root, target));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readText(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

function readJson(filePath, fallback = null) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (error) {
    return { ok: false, value: fallback, error: error.message };
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, 'utf8');
}

function appendJsonl(filePath, record) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

function readJsonl(filePath) {
  const raw = readText(filePath);
  const records = [];
  const errors = [];
  raw.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      records.push(JSON.parse(trimmed));
    } catch (error) {
      errors.push({ line: index + 1, message: error.message });
    }
  });
  return { records, errors };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const body = keys
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',');
    return `{${body}}`;
  }
  return JSON.stringify(value ?? null);
}

function hashRecord(value) {
  return sha256(canonicalJson(value));
}

function nowIso() {
  return new Date().toISOString();
}

function listDirectories(dirPath) {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.name.startsWith('.') === false)
      .filter((entry) => {
        if (entry.isDirectory()) return true;
        if (typeof entry.isSymbolicLink !== 'function' || !entry.isSymbolicLink()) return false;
        try {
          return fs.statSync(path.join(dirPath, entry.name)).isDirectory();
        } catch {
          return false;
        }
      })
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function listFiles(dirPath, extension) {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => (extension ? name.endsWith(extension) : true))
      .sort();
  } catch {
    return [];
  }
}

function walkFiles(root, startDir, visit) {
  if (!fs.existsSync(startDir)) return;
  for (const entry of fs.readdirSync(startDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_WALK_DIRS.has(entry.name)) continue;
      walkFiles(root, fullPath, visit);
    } else if (entry.isFile()) {
      visit(fullPath, relative(root, fullPath));
    }
  }
}

/**
 * Minimal top-level YAML frontmatter parser. Supports scalars, quoted strings,
 * and nested mappings; sufficient for agent and skill manifests.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { present: false, fields: {}, raw: '' };
  const fields = {};
  let currentTop = null;
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const topMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (topMatch) {
      let rawValue = topMatch[2].trim();
      if (
        (rawValue.startsWith("'") && rawValue.endsWith("'")) ||
        (rawValue.startsWith('"') && rawValue.endsWith('"'))
      ) {
        rawValue = rawValue.slice(1, -1);
      }
      if (rawValue === '') {
        fields[topMatch[1]] = {};
        currentTop = topMatch[1];
      } else {
        fields[topMatch[1]] = rawValue;
        currentTop = null;
      }
      continue;
    }
    const nestedMatch = line.match(/^\s+([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (nestedMatch && currentTop && typeof fields[currentTop] === 'object') {
      fields[currentTop][nestedMatch[1]] = nestedMatch[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return { present: true, fields, raw: match[1] };
}

function hasSection(content, section) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^#{1,6}\\s+${escaped}\\b`, 'im').test(content);
}

function firstHeading(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function pathExists(root, relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function isInside(relPath, prefixes) {
  return prefixes.some((prefix) => relPath === prefix || relPath.startsWith(`${prefix}/`));
}

function truncate(value, max = 160) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

module.exports = {
  appendJsonl,
  canonicalJson,
  ensureDir,
  firstHeading,
  hasSection,
  hashRecord,
  isExecutable,
  isInside,
  listDirectories,
  listFiles,
  nowIso,
  parseFrontmatter,
  pathExists,
  readJson,
  readJsonl,
  readText,
  relative,
  sha256,
  toPosix,
  truncate,
  walkFiles,
  writeJson,
  writeText,
};
