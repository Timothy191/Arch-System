#!/usr/bin/env node
/**
 * Validates every tracked *.json file parses cleanly.
 * Catches syntax errors (trailing commas, comments in strict JSON, etc.)
 * that Biome's formatter may not surface as a hard failure.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

function stripJsonComments(text) {
  // Strip // line comments and /* */ block comments (JSONC support for tsconfig etc.)
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const jsonFiles = execSync('git ls-files "*.json"', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !f.includes('node_modules'));

// Also cover JSONC-style configs used by TS/Next.js toolchains.
const jsoncFiles = execSync('git ls-files "*.jsonc" "tsconfig*.json" "jsconfig*.json"', {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
  .filter((f) => !f.includes('node_modules'));

let failed = 0;
let total = 0;
for (const file of jsonFiles) {
  total += 1;
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failed += 1;
    console.error(`INVALID JSON: ${file}\n  ${error.message}`);
  }
}
for (const file of jsoncFiles) {
  if (jsonFiles.includes(file)) continue;
  total += 1;
  try {
    JSON.parse(stripJsonComments(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    failed += 1;
    console.error(`INVALID JSONC: ${file}\n  ${error.message}`);
  }
}
if (failed > 0) {
  console.error(`\n${failed} invalid JSON/JSONC file(s).`);
  process.exit(1);
}
console.log(`OK: ${total} JSON/JSONC files validated (incl. TS/Next.js configs).`);
