#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const worktree = require('./worktree');
const aggregator = require('./aggregator');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const DEFAULT_MODEL = process.env.AGENT_MODEL || 'sonnet';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '3', 10);

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

function parseUnits(input) {
  if (input.units && Array.isArray(input.units)) return input.units;
  return [input];
}

async function executeUnit(unit, worktreeDir) {
  const harness = unit.harness || 'opencode';
  const model = unit.model || DEFAULT_MODEL;
  const prompt = unit.instructions || unit.description || '';
  const workdir = worktreeDir || unit.workdir || PROJ;
  const timeoutSec = unit.timeout_seconds || 120;

  const agentConfigs = {
    opencode: { cmd: 'opencode', args: ['--print', prompt] },
    claude: { cmd: 'claude', args: ['--print', prompt, '-m', model] },
    codex: { cmd: 'codex', args: ['--print', '-m', model, '-p', prompt] },
  };

  const config = agentConfigs[harness];
  if (!config) {
    return { unit: unit.id || 'unknown', harness, status: 'error', error: `Unknown harness: ${harness}` };
  }

  const instructionsFile = unit.instructions_file || path.join(workdir, 'AGENTS.md');
  if (unit.context && !fs.existsSync(instructionsFile)) {
    fs.writeFileSync(instructionsFile, unit.context);
  }

  return new Promise(resolve => {
    const proc = spawn(config.cmd, config.args, {
      cwd: workdir,
      env: { ...process.env, HOME: process.env.HOME, PATH: process.env.PATH },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutSec * 1000
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      const timedOut = code === null;
      resolve({
        unit: unit.id || 'unknown',
        harness,
        model,
        status: code === 0 ? 'ok' : (code === null ? 'timeout' : 'error'),
        exit_code: code,
        timed_out: timedOut,
        stdout: stdout.slice(0, 50000),
        stderr: stderr.slice(0, 10000),
        duration_seconds: 0
      });
    });

    proc.on('error', err => {
      resolve({
        unit: unit.id || 'unknown',
        harness,
        status: 'error',
        error: err.message
      });
    });
  });
}

async function main() {
  const raw = await readStdin();
  let input = {};
  try { input = JSON.parse(raw); } catch { input = { units: [{ description: raw }] }; }

  const units = parseUnits(input);
  if (units.length === 0) {
    console.error(JSON.stringify({ error: 'No units provided' }));
    process.exit(1);
  }

  console.error(`[orchestrator] Decomposing ${units.length} units, max ${MAX_CONCURRENT} concurrent`);

  const results = [];
  const worktreeDirs = [];

  // Create worktrees for units that need isolation
  for (const unit of units) {
    if (unit.isolated) {
      const wtDir = worktree.create(unit.id || `unit-${Date.now()}`);
      if (wtDir) {
        worktreeDirs.push({ id: unit.id, dir: wtDir });
        unit.workdir = wtDir;
      }
    }
  }

  // Execute units with concurrency limit
  const queue = [...units];
  const running = [];

  while (queue.length > 0 || running.length > 0) {
    while (running.length < MAX_CONCURRENT && queue.length > 0) {
      const unit = queue.shift();
      const promise = executeUnit(unit, unit.workdir).then(result => {
        results.push(result);
        return result;
      });
      running.push(promise);
    }

    if (running.length > 0) {
      await Promise.race(running);
      // Remove completed promises
      for (let i = running.length - 1; i >= 0; i--) {
        const isDone = await Promise.race([
          running[i].then(() => true),
          new Promise(r => setTimeout(() => r(false), 100))
        ]);
        if (isDone) running.splice(i, 1);
      }
    }
  }

  // Clean up worktrees
  for (const wt of worktreeDirs) {
    if (input.keep_worktrees) {
      console.error(`[orchestrator] Keeping worktree: ${wt.dir}`);
    } else {
      worktree.remove(wt.id);
    }
  }

  // Aggregate results
  const aggregated = aggregator.merge(results, input.strategy || 'merge');

  const output = {
    total_units: units.length,
    succeeded: results.filter(r => r.status === 'ok').length,
    failed: results.filter(r => r.status !== 'ok').length,
    results,
    aggregated
  };

  process.stdout.write(JSON.stringify(output, null, 2));
  process.exit(output.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
