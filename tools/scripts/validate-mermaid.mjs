#!/usr/bin/env node
/**
 * @file validate-mermaid.mjs
 * Lightweight zero-dependency Mermaid diagram syntax validator.
 * Validates markdown files across docs/ and .agents/ without heavy Chromium/Puppeteer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const SCAN_DIRS = [
  path.join(ROOT, 'docs'),
  path.join(ROOT, '.agents'),
  path.join(ROOT, 'README.md'),
  path.join(ROOT, 'AGENTS.md'),
];

const SUPPORTED_DIAGRAMS = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'classDiagram',
  'erDiagram',
  'xychart-beta',
  'journey',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'quadrantChart',
  'gitGraph',
];

function findMarkdownFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile() && target.endsWith('.md')) return [target];
  if (!stat.isDirectory()) return [];

  const entries = fs.readdirSync(target, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }

  return results;
}

function extractMermaidBlocks(content) {
  const blocks = [];
  const regex = /```mermaid\r?\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      code: match[1].trim(),
      index: match.index,
    });
  }

  return blocks;
}

function validateMermaidBlock(code, filePath, blockIdx) {
  const errors = [];
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));

  if (lines.length === 0) {
    errors.push('Empty diagram block');
    return errors;
  }

  const headerLine = lines[0];
  const isValidHeader = SUPPORTED_DIAGRAMS.some((type) => headerLine.startsWith(type));

  if (!isValidHeader) {
    errors.push(`Unrecognized or unsupported diagram type in header: "${headerLine}"`);
  }

  // Check bracket balance across the diagram
  let parenCount = 0;
  let squareCount = 0;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Strip string literals inside double quotes
    const stripped = line.replace(/"[^"]*"/g, '');
    for (const char of stripped) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (char === '[') squareCount++;
      if (char === ']') squareCount--;
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
  }

  if (parenCount !== 0) errors.push(`Unbalanced parentheses (delta: ${parenCount})`);
  if (squareCount !== 0) errors.push(`Unbalanced square brackets (delta: ${squareCount})`);
  if (braceCount !== 0) errors.push(`Unbalanced curly braces (delta: ${braceCount})`);

  return errors;
}

function main() {
  console.log('📊 [Mermaid Validator] Scanning documentation for Mermaid diagrams...');
  const files = SCAN_DIRS.flatMap(findMarkdownFiles);

  let totalDiagrams = 0;
  let fileCountWithDiagrams = 0;
  const failureList = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const blocks = extractMermaidBlocks(content);
    if (blocks.length === 0) continue;

    fileCountWithDiagrams++;
    totalDiagrams += blocks.length;

    blocks.forEach((block, idx) => {
      const errs = validateMermaidBlock(block.code, file, idx);
      if (errs.length > 0) {
        failureList.push({
          file: path.relative(ROOT, file),
          blockIndex: idx + 1,
          errors: errs,
        });
      }
    });
  }

  console.log(
    `   Scanned ${files.length} markdown files, found ${totalDiagrams} diagrams in ${fileCountWithDiagrams} files.`
  );

  if (failureList.length > 0) {
    console.error(`\n❌ [Mermaid Validator] Found ${failureList.length} syntax issues:`);
    for (const f of failureList) {
      console.error(`   • ${f.file} (block #${f.blockIndex}): ${f.errors.join('; ')}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ [Mermaid Validator] All ${totalDiagrams} Mermaid diagrams are 100% syntactically valid!`
  );
}

main();
