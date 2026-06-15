#!/usr/bin/env node
/**
 * portal-test-on-edit: PostToolUse hook (async)
 *
 * When a portal source file is edited and a co-located test file already
 * exists, run that test file in isolation. The goal is fast feedback on the
 * most blast-radius-heavy code paths: API routes and the AI subsystem.
 *
 * Scope: apps/portal/app/api/** and apps/portal/lib/ai/**
 * Trigger: a *.test.ts or *.test.tsx file already exists for the source
 *   (either co-located as foo.test.ts next to foo.ts, or in __tests__ dirs)
 *
 * Async: true — does not block the agent loop.
 *
 * Pairs with the test-writer and integration-tester agents.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

const SCOPE_PATTERNS = [
  /^apps\/portal\/app\/api\/.+\.(ts|tsx|js|jsx)$/,
  /^apps\/portal\/lib\/ai\/.+\.(ts|tsx|js|jsx)$/,
];

function isInScope(filePath) {
  return SCOPE_PATTERNS.some((re) => re.test(filePath));
}

function findCoLocatedTest(sourcePath) {
  const ext = path.extname(sourcePath);
  const base = sourcePath.slice(0, -ext.length);
  const candidates = [
    `${base}.test${ext}`,
    `${base}.spec${ext}`,
    path.join(path.dirname(sourcePath), '__tests__', `${path.basename(base)}.test${ext}`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

(async () => {
  const raw = await readStdin();
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const filePath =
    input?.tool_response?.filePath || input?.tool_input?.file_path || input?.tool_input?.TargetFile || '';
  if (!filePath || !isInScope(filePath)) process.exit(0);

  const testFile = findCoLocatedTest(filePath);
  if (!testFile) process.exit(0);

  try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const relTest = path.relative(projectDir, testFile);
    const out = execSync(`pnpm --filter portal exec jest "${relTest}" --silent --maxWorkers=1 2>&1 | tail -40`, {
      timeout: 60000,
      stdio: 'pipe',
    });
    if (out.toString().includes('Tests:') && !out.toString().includes('failed')) {
      console.error(`[portal-test-on-edit] ${relTest} passed.`);
    } else {
      console.error(`[portal-test-on-edit] ${relTest} output:\n${out.toString()}`);
    }
  } catch (err) {
    const stdout = (err.stdout || '').toString();
    const stderr = (err.stderr || '').toString();
    console.error(`[portal-test-on-edit] ${testFile} failed:\n${stdout}\n${stderr}`);
  }
  process.exit(0);
})();
