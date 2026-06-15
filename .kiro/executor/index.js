#!/usr/bin/env node
const { spawn } = require('child_process');

function parseInput() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data || '{"tasks":[]}')); }
      catch { resolve({ tasks: [] }); }
    });
  });
}

async function runTask(task, timeoutMs = 30000) {
  return new Promise(resolve => {
    const start = Date.now();
    const { command, args, name } = task;

    if (command) {
      const parts = typeof command === 'string' ? command.split(/\s+/) : command;
      const cmd = parts[0];
      const cmdArgs = parts.slice(1);
      const proc = spawn(cmd, cmdArgs, {
        timeout: timeoutMs,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...(task.env || {}) }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      proc.on('close', code => {
        resolve({
          name: name || command,
          status: code === 0 ? 'ok' : 'error',
          exit_code: code,
          stdout: stdout.slice(0, 10000),
          stderr: stderr.slice(0, 5000),
          duration_ms: Date.now() - start
        });
      });
      proc.on('error', err => {
        resolve({ name: name || command, status: 'error', error: err.message, duration_ms: Date.now() - start });
      });
    } else if (task.fn) {
      Promise.resolve().then(async () => {
        try {
          const result = await task.fn();
          resolve({ name: name || 'fn', status: 'ok', result, duration_ms: Date.now() - start });
        } catch (err) {
          resolve({ name: name || 'fn', status: 'error', error: err.message, duration_ms: Date.now() - start });
        }
      });
    } else {
      resolve({ name: name || 'unknown', status: 'error', error: 'No command or fn specified', duration_ms: Date.now() - start });
    }
  });
}

async function executeAll(tasks, options = {}) {
  const concurrency = options.concurrency || 3;
  const timeout = options.timeout || 60000;
  const results = [];
  let running = 0;
  let idx = 0;

  return new Promise(resolve => {
    function next() {
      if (idx >= tasks.length && running === 0) {
        return resolve(results);
      }
      while (running < concurrency && idx < tasks.length) {
        const taskIdx = idx++;
        running++;
        runTask(tasks[taskIdx], timeout).then(result => {
          results[taskIdx] = result;
          running--;
          next();
        });
      }
    }
    next();
  });
}

if (require.main === module) {
  (async () => {
    const input = await parseInput();
    const tasks = input.tasks || [];
    const concurrency = parseInt(process.argv[2] || '3', 10);
    const timeout = parseInt(process.argv[3] || '60000', 10);

    const results = await executeAll(tasks, { concurrency, timeout });
    const summary = {
      total: results.length,
      ok: results.filter(r => r.status === 'ok').length,
      errors: results.filter(r => r.status === 'error').length,
      total_duration: results.reduce((sum, r) => sum + (r.duration_ms || 0), 0),
      max_duration: results.reduce((max, r) => Math.max(max, r.duration_ms || 0), 0),
      results
    };
    console.log(JSON.stringify(summary, null, 2));
  })().catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
}

module.exports = { executeAll, runTask };
