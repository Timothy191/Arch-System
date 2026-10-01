// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCommandLineArgs,
  getHelpText,
  formatConsoleOutput,
  runCli,
  CLI_OPTIONS,
} from '../../src/cli.mjs';

function createMockIo(envOverrides = {}) {
  let stdout = '';
  let stderr = '';
  return {
    stdout: {
      write: (msg) => {
        stdout += msg;
        return true;
      },
      toString: () => stdout,
    },
    stderr: {
      write: (msg) => {
        stderr += msg;
        return true;
      },
      toString: () => stderr,
    },
    env: { ...process.env, ...envOverrides },
  };
}

describe('Unit: Watchdog CLI Interface & Options Parser', () => {
  describe('parseCommandLineArgs', () => {
    it('parses all required CLI flags cleanly via node:util parseArgs', () => {
      const args = [
        '--dir',
        '/tmp/repo',
        '--branch',
        'feature/telemetry',
        '--repo',
        'plantcor/arch-system',
        '--project',
        'prj_mining',
        '--team',
        'team_ops',
        '--poll-timeout',
        '120',
        '--poll-interval',
        '3',
        '--json',
        '--fix',
        '--audit-only',
      ];
      const parsed = parseCommandLineArgs(args);
      assert.equal(parsed.success, true);
      assert.equal(parsed.values.dir, '/tmp/repo');
      assert.equal(parsed.values.branch, 'feature/telemetry');
      assert.equal(parsed.values.repo, 'plantcor/arch-system');
      assert.equal(parsed.values.project, 'prj_mining');
      assert.equal(parsed.values.team, 'team_ops');
      assert.equal(parsed.values['poll-timeout'], '120');
      assert.equal(parsed.values['poll-interval'], '3');
      assert.equal(parsed.values.json, true);
      assert.equal(parsed.values.fix, true);
      assert.equal(parsed.values['audit-only'], true);
    });

    it('rejects unknown CLI options returning success false and error', () => {
      const parsed = parseCommandLineArgs(['--nonexistent-flag-xyz']);
      assert.equal(parsed.success, false);
      assert.ok(parsed.error);
    });
  });

  describe('getHelpText', () => {
    it('documents all CLI flags and standard exit codes', () => {
      const help = getHelpText();
      assert.match(help, /--audit-only/);
      assert.match(help, /--fix/);
      assert.match(help, /--dir/);
      assert.match(help, /--branch/);
      assert.match(help, /--repo/);
      assert.match(help, /--project/);
      assert.match(help, /--team/);
      assert.match(help, /--poll-timeout/);
      assert.match(help, /--poll-interval/);
      assert.match(help, /--json/);
      assert.match(help, /-h, --help/);
      assert.match(help, /0\s+Parity confirmed/);
      assert.match(help, /1\s+Drift detected/);
      assert.match(help, /2\s+Fatal error/);
    });
  });

  describe('formatConsoleOutput', () => {
    it('formats parity report with confirmation banner', () => {
      const report = {
        timestamp: '2026-10-01T00:00:00Z',
        target: {
          directory: '/app',
          repository: 'plantcor/arch-system',
          branch: 'main',
          vercelProject: 'arch-system',
        },
        state: {
          local: {
            commit: '1111111111111111111111111111111111111111',
            branch: 'main',
            isClean: true,
          },
          github: { commit: '1111111111111111111111111111111111111111', branch: 'main' },
          vercel: {
            commit: '1111111111111111111111111111111111111111',
            state: 'READY',
            url: 'app.vercel.app',
          },
        },
        drift: { hasDrift: false, isDirty: false },
        actionsTaken: [],
        resolved: true,
      };

      const out = formatConsoleOutput(report);
      assert.match(out, /ZERO DRIFT WATCHDOG/i);
      assert.match(out, /Zero drift/i);
      assert.match(out, /parity confirmed/i);
    });

    it('formats drift report with detailed classifications', () => {
      const report = {
        timestamp: '2026-10-01T00:00:00Z',
        target: {
          directory: '/app',
          repository: 'plantcor/arch-system',
          branch: 'main',
          vercelProject: 'arch-system',
        },
        state: {
          local: { commit: '2222', branch: 'main', isClean: false, uncommittedFiles: ['foo.js'] },
          github: { commit: '1111', branch: 'main' },
          vercel: { commit: '0000', state: 'READY', url: 'app.vercel.app', inFlightCommit: '2222' },
        },
        drift: {
          hasDrift: true,
          localAhead: true,
          localBehind: false,
          vercelBehind: true,
          dirtyWorkingTree: true,
          isDirty: true,
          diverged: false,
          inFlight: true,
        },
        actionsTaken: ['pushed commit'],
        resolved: false,
      };

      const out = formatConsoleOutput(report);
      assert.match(out, /DRIFT DETECTED/i);
      assert.match(out, /Local Ahead/i);
      assert.match(out, /Vercel Behind/i);
      assert.match(out, /Dirty Working Tree/i);
      assert.match(out, /In-Flight Build/i);
      assert.match(out, /pushed commit/i);
    });
  });

  describe('runCli', () => {
    it('outputs help text and exits 0 on --help', async () => {
      const io = createMockIo();
      const code = await runCli(['--help'], io);
      assert.equal(code, 0);
      assert.match(io.stdout.toString(), /Usage: zero-drift-watchdog/i);
      assert.match(io.stdout.toString(), /--audit-only/);
    });

    it('outputs version and exits 0 on --version', async () => {
      const io = createMockIo();
      const code = await runCli(['--version'], io);
      assert.equal(code, 0);
      assert.match(io.stdout.toString(), /zero-drift-watchdog v1\.0\.0/);
    });

    it('rejects unknown CLI options with exit code 2 and usage text', async () => {
      const io = createMockIo();
      const code = await runCli(['--invalid-flag-abc'], io);
      assert.equal(code, 2);
      assert.match(io.stderr.toString(), /CLI Error/i);
      assert.match(io.stderr.toString(), /Usage:/i);
    });

    it('exits 2 when GITHUB_TOKEN is missing', async () => {
      const io = createMockIo({ GITHUB_TOKEN: '', GH_TOKEN: '', VERCEL_TOKEN: 'mock-vc' });
      const code = await runCli(['--audit-only'], io);
      assert.equal(code, 2);
      assert.match(io.stderr.toString() + io.stdout.toString(), /github.*token/i);
    });

    it('exits 2 when VERCEL_TOKEN is missing', async () => {
      const io = createMockIo({ GITHUB_TOKEN: 'mock-gh', VERCEL_TOKEN: '' });
      const code = await runCli(['--audit-only'], io);
      assert.equal(code, 2);
      assert.match(io.stderr.toString() + io.stdout.toString(), /vercel.*token/i);
    });

    it('outputs structured JSON error when token is missing and --json flag is provided', async () => {
      const io = createMockIo({ GITHUB_TOKEN: '', GH_TOKEN: '', VERCEL_TOKEN: 'mock-vc' });
      const code = await runCli(['--json'], io);
      assert.equal(code, 2);
      const parsed = JSON.parse(io.stdout.toString());
      assert.equal(parsed.exitCode, 2);
      assert.match(parsed.message, /github/i);
    });

    it('rejects malformed --repo flag without slash', async () => {
      const io = createMockIo({ GITHUB_TOKEN: 'token', VERCEL_TOKEN: 'token' });
      const code = await runCli(['--repo', 'invalid-repo-format'], io);
      assert.equal(code, 2);
      assert.match(io.stderr.toString(), /invalid --repo format/i);
    });
  });
});
