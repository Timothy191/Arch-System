// @ts-check
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '../..');
export const CLI_PATH = path.resolve(PROJECT_ROOT, 'bin/zero-drift-watchdog.mjs');

/**
 * Check if the CLI executable exists on disk
 * @returns {boolean}
 */
export function hasCli() {
  return fs.existsSync(CLI_PATH);
}

/**
 * Check if a source module exists in src/
 * @param {string} moduleName
 * @returns {boolean}
 */
export function hasModule(moduleName) {
  return fs.existsSync(path.resolve(PROJECT_ROOT, 'src', moduleName));
}

/**
 * Helper to skip test if CLI is not yet implemented
 * @param {any} t - test context
 * @returns {boolean} true if CLI exists, false if skipped
 */
export function requireCli(t) {
  if (!hasCli()) {
    t.skip('Pending CLI implementation: bin/zero-drift-watchdog.mjs');
    return false;
  }
  return true;
}

/**
 * Execute the zero-drift-watchdog CLI binary
 *
 * @param {string[]} args
 * @param {object} [options]
 * @param {Record<string, string>} [options.env]
 * @param {string} [options.cwd]
 * @param {number} [options.timeout=10000]
 * @returns {{ status: number|null, stdout: string, stderr: string, json: any|null }}
 */
export async function runWatchdog(args, options = {}) {
  const env = {
    ...process.env,
    ...(options.env ?? {}),
  };

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: options.cwd ?? PROJECT_ROOT,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ status: null, stdout, stderr, json: null });
    }, options.timeout ?? 10000);

    child.on('close', (code) => {
      clearTimeout(timer);
      let json = null;
      try {
        const firstBrace = stdout.indexOf('{');
        const lastBrace = stdout.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          json = JSON.parse(stdout.slice(firstBrace, lastBrace + 1));
        }
      } catch {}
      resolve({ status: code, stdout, stderr, json });
    });
  });
}
