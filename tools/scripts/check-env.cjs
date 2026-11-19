#!/usr/bin/env node
'use strict';

/**
 * @file tools/scripts/check-env.cjs
 * @description Non-destructive environment preflight validator aligned with
 * libs/shared/utils/src/env.ts. Validates dev, test, or prod configurations
 * without ever printing raw secret values.
 *
 * Usage:
 *   node tools/scripts/check-env.cjs [--target=dev|test|prod]
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PLACEHOLDER_RE = /^(?:\.\.\.|your[-_]|change[-_]?me|replace[-_]?me|example|todo)/i;
const VALID_TARGETS = new Set(['dev', 'test', 'prod']);

function parseTarget(argv) {
  const arg = argv.find((token) => token.startsWith('--target='));
  const target = arg ? arg.split('=')[1] : 'dev';
  if (!VALID_TARGETS.has(target)) {
    console.error(`❌ Invalid --target="${target}". Expected dev, test, or prod.`);
    process.exit(1);
  }
  return target;
}

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function isPlaceholder(value) {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed.length === 0 || PLACEHOLDER_RE.test(trimmed);
}

function isValidHttpUrl(value) {
  if (isPlaceholder(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function formatPresence(value) {
  if (!value || value.trim().length === 0) return 'MISSING';
  if (PLACEHOLDER_RE.test(value.trim())) return 'PLACEHOLDER';
  return `SET (len=${value.trim().length})`;
}

function main() {
  const target = parseTarget(process.argv.slice(2));
  const rootEnvPath = path.join(ROOT, '.env');
  const portalEnvPath = path.join(ROOT, 'apps', 'portal', '.env');
  const portalLocalEnvPath = path.join(ROOT, 'apps', 'portal', '.env.local');
  const toolsEnvPath = path.join(ROOT, '.env.tools');

  const merged = {
    ...parseDotEnvFile(rootEnvPath),
    ...parseDotEnvFile(portalEnvPath),
    ...parseDotEnvFile(portalLocalEnvPath),
    ...process.env,
  };

  const errors = [];
  const warnings = [];

  if (!fs.existsSync(portalEnvPath) && !fs.existsSync(portalLocalEnvPath)) {
    const msg = 'Missing apps/portal/.env (run ./setup.sh to bootstrap from .env.example).';
    if (target === 'test') warnings.push(msg);
    else errors.push(msg);
  }

  const supabaseUrl = merged.NEXT_PUBLIC_SUPABASE_URL || merged.SUPABASE_URL || '';
  const supabaseKey =
    merged.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    merged.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    merged.SUPABASE_ANON_KEY ||
    '';
  const redisUrl = merged.REDIS_URL || '';

  if (!isValidHttpUrl(supabaseUrl)) {
    const msg = `Supabase URL (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL) is invalid or missing (${formatPresence(supabaseUrl)}).`;
    if (target === 'test') warnings.push(msg);
    else errors.push(msg);
  }

  if (isPlaceholder(supabaseKey)) {
    const msg = `Supabase public/anon key is missing or placeholder (${formatPresence(supabaseKey)}).`;
    if (target === 'test') warnings.push(msg);
    else errors.push(msg);
  }

  if (redisUrl && !/^rediss?:\/\//.test(redisUrl)) {
    errors.push('REDIS_URL must begin with redis:// or rediss:// when configured.');
  }

  if (fs.existsSync(toolsEnvPath)) {
    const toolsVars = parseDotEnvFile(toolsEnvPath);
    const placeholderKeys = Object.entries(toolsVars)
      .filter(([, val]) => isPlaceholder(val))
      .map(([key]) => key);
    if (placeholderKeys.length > 0) {
      warnings.push(
        `.env.tools contains ${placeholderKeys.length} placeholder key(s) (${placeholderKeys.slice(0, 4).join(', ')}${placeholderKeys.length > 4 ? ', ...' : ''}) — advisory only unless running Docker tools.`
      );
    }
  }

  console.log(`🔍 [ENV CHECK] target=${target}`);
  console.log(`   • apps/portal/.env: ${fs.existsSync(portalEnvPath) ? 'PRESENT' : 'ABSENT'}`);
  console.log(`   • SUPABASE_URL:     ${formatPresence(supabaseUrl)}`);
  console.log(`   • SUPABASE_KEY:     ${formatPresence(supabaseKey)}`);
  console.log(`   • REDIS_URL:        ${formatPresence(redisUrl)}`);

  for (const w of warnings) {
    console.warn(`⚠️  ${w}`);
  }
  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`❌ ${e}`);
    }
    process.exit(1);
  }

  console.log(`✅ Environment preflight passed (${target}).`);
}

main();
