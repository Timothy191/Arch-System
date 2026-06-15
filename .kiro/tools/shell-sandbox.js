#!/usr/bin/env node
const { execSync } = require('child_process');

const ALLOWED_PREFIXES = [
  'git', 'npm', 'pnpm', 'node', 'python3', 'python',
  'ls', 'cat', 'echo', 'mkdir', 'cp', 'mv', 'rmdir', 'touch',
  'curl', 'wget', 'docker', 'psql', 'sqlite3',
  'pnpx', 'npx', 'nohup', 'tsc', 'eslint', 'prettier',
  'jq', 'grep', 'rg', 'find', 'sleep', 'cd', 'pwd', 'which',
  'bash -n', 'timeout', 'kill', 'env',
];

const DANGEROUS_PATTERNS = [
  /\brm\s+(-[rRf]+\s+)*-?[rRf]/,
  /\bsudo\b/,
  /\bchmod\s+777\b/,
  /\bchown\b/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  />\s*\/dev\//,
  /\bcurl\s+.*\|\s*(ba)?sh/,
  /\bwget\s+.*\|\s*(ba)?sh/,
  /\bdocker\s+(rm|rmi|system\s+prune)/,
  /\bnpm\s+publish\b/,
  /\bgit\s+push\s+--force\b/,
  /\bgit\s+reset\s+--hard\b/,
];

const MAX_OUTPUT = 102400;
const MAX_EXEC_SECONDS = 30;
const PROJ = process.env.PROJECT_DIR || '/home/timothy/Project/Arch-Mk2';

function validate(command) {
  const issues = [];
  const trimmed = command.trim();

  if (!trimmed) {
    return { valid: false, issues: ['Empty command'] };
  }

  const firstToken = trimmed.split(/\s+/)[0];
  if (!ALLOWED_PREFIXES.some(p => firstToken.startsWith(p))) {
    issues.push(`Command '${firstToken}' not in allowed prefixes`);
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      issues.push(`Dangerous pattern detected: ${pattern}`);
    }
  }

  return { valid: issues.length === 0, issues };
}

function execute(command) {
  const validation = validate(command);
  if (!validation.valid) {
    return { exitCode: 1, stdout: '', stderr: `Sandbox blocked: ${validation.issues.join('; ')}`, blocked: true };
  }

  try {
    const result = execSync(command, {
      cwd: PROJ,
      timeout: MAX_EXEC_SECONDS * 1000,
      maxBuffer: MAX_OUTPUT,
      encoding: 'utf8',
      env: { ...process.env, PATH: process.env.PATH }
    });
    return { exitCode: 0, stdout: result.slice(0, MAX_OUTPUT), stderr: '' };
  } catch (err) {
    const stdout = err.stdout?.slice(0, MAX_OUTPUT) || '';
    const stderr = err.stderr?.slice(0, MAX_OUTPUT) || '';
    const exitCode = err.status || 1;
    if (err.killed) {
      return { exitCode: 124, stdout, stderr: `TIMEOUT after ${MAX_EXEC_SECONDS}s\n${stderr}` };
    }
    return { exitCode, stdout, stderr };
  }
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

(async () => {
  const raw = await readStdin();
  let input = { command: process.argv.slice(2).join(' ') };
  try { const parsed = JSON.parse(raw); if (parsed.command) input = parsed; } catch {}

  if (!input.command) {
    const mode = process.argv[2];
    if (mode === '--validate') {
      const cmd = process.argv.slice(3).join(' ');
      const result = validate(cmd);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);
    }
    process.exit(0);
  }

  const result = execute(input.command);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.exitCode);
})().catch(() => process.exit(1));
