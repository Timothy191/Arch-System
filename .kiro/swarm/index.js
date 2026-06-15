#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const SWARM_FILE = path.join(PROJ, '.kiro', 'swarm', 'state.json');
const WORKERS_DIR = path.join(PROJ, '.kiro', 'swarm', 'workers');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const WORKER_TIMEOUT = parseInt(process.env.WORKER_TIMEOUT || '120000', 10);
const MAX_PARALLEL = parseInt(process.env.MAX_PARALLEL_WORKERS || '5', 10);

function loadState() {
  try {
    if (fs.existsSync(SWARM_FILE)) return JSON.parse(fs.readFileSync(SWARM_FILE, 'utf8'));
  } catch {}
  return { runs: [], workers: [], next_id: 1, started_at: null };
}

function saveState(state) {
  try {
    const dir = path.dirname(SWARM_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SWARM_FILE, JSON.stringify(state, null, 2));
  } catch {}
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

function parseInput(raw) {
  try { return JSON.parse(raw || '{}'); }
  catch { return {}; }
}

function decomposeGoal(goal, context) {
  const tasks = [];
  const lines = goal.split('\n').filter(l => l.trim());
  const currentTask = { id: null, description: '', files: [], dependencies: [], priority: 5 };

  for (const line of lines) {
    const taskMatch = line.match(/^[-*]\s*(?:\[?([^\]]+)\]?)?\s*(.+)/);
    if (taskMatch) {
      if (currentTask.description) tasks.push({ ...currentTask });
      currentTask.id = `task_${Date.now()}_${tasks.length}`;
      currentTask.description = taskMatch[2] || taskMatch[1];
      currentTask.files = [];
      currentTask.dependencies = [];
    }
    const fileMatch = line.match(/file[:\s]+['\"]?([^'\"\n]+)['\"]?/i);
    if (fileMatch) currentTask.files.push(fileMatch[1]);
    const depMatch = line.match(/depends?[:\s]+['\"]?([^'\"\n]+)['\"]?/i);
    if (depMatch) currentTask.dependencies.push(depMatch[1]);
  }
  if (currentTask.description) tasks.push({ ...currentTask });

  if (tasks.length === 0) {
    tasks.push({
      id: `task_${Date.now()}_0`,
      description: goal,
      files: context.files || [],
      dependencies: [],
      priority: 5
    });
  }
  return tasks;
}

class Foreman {
  constructor(input) {
    this.goal = input.goal || input.description || '';
    this.context = input.context || {};
    this.tasks = [];
    this.runId = null;
    this.state = loadState();
    this.workers = [];
    this.startedAt = null;
  }

  async orchestrate() {
    this.startedAt = Date.now();
    this.runId = `run_${this.state.next_id++}_${Date.now()}`;
    this.tasks = decomposeGoal(this.goal, this.context);

    const run = {
      id: this.runId,
      goal: this.goal,
      started_at: new Date().toISOString(),
      status: 'running',
      tasks: this.tasks.map(t => ({ ...t, status: 'pending', worker_id: null })),
      workers: [],
      results: []
    };
    this.state.runs.push(run);
    if (this.state.runs.length > 50) this.state.runs.shift();
    saveState(this.state);

    return this._executePipeline();
  }

  async _executePipeline() {
    const pending = [...this.tasks];
    const running = [];
    const completed = [];
    const failed = [];
    let workerSlots = MAX_PARALLEL;

    while (pending.length > 0 || running.length > 0) {
      while (pending.length > 0 && running.length < workerSlots) {
        const task = pending.shift();
        const worker = await this._spawnWorker(task);
        running.push(worker);
      }

      if (running.length === 0) break;

      const worker = await this._awaitAnyWorker(running);
      running.splice(running.indexOf(worker), 1);
      const idx = this.state.runs.findIndex(r => r.id === this.runId);
      if (idx >= 0) {
        const taskInRun = this.state.runs[idx].tasks.find(t => t.id === worker.taskId);
        if (taskInRun) {
          taskInRun.status = worker.status;
          taskInRun.worker_id = worker.id;
        }
        this.state.runs[idx].workers.push({
          id: worker.id,
          task_id: worker.taskId,
          status: worker.status,
          duration_ms: worker.durationMs,
          started_at: worker.startedAt
        });
        if (worker.status === 'ok') {
          this.state.runs[idx].results.push(worker.result);
        }
      }
      saveState(this.state);

      if (worker.status === 'ok') {
        completed.push(worker);
      } else {
        failed.push(worker);
      }
    }

    const runIdx = this.state.runs.findIndex(r => r.id === this.runId);
    if (runIdx >= 0) {
      this.state.runs[runIdx].status = failed.length === 0 ? 'completed' : 'completed_with_errors';
      this.state.runs[runIdx].ended_at = new Date().toISOString();
      this.state.runs[runIdx].duration_ms = Date.now() - this.startedAt;
      saveState(this.state);
    }

    return {
      run_id: this.runId,
      goal: this.goal,
      status: failed.length === 0 ? 'completed' : 'completed_with_errors',
      duration_ms: Date.now() - this.startedAt,
      tasks: {
        total: this.tasks.length,
        completed: completed.length,
        failed: failed.length
      },
      results: completed.map(w => w.result).filter(Boolean),
      errors: failed.map(w => ({ task_id: w.taskId, error: w.error }))
    };
  }

  async _spawnWorker(task) {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = new Date().toISOString();
    const workerStartMs = Date.now();

    const worker = {
      id: workerId,
      taskId: task.id,
      taskDesc: task.description,
      status: 'running',
      startedAt,
      durationMs: 0,
      result: null,
      error: null,
      process: null
    };

    const taskInput = JSON.stringify({
      task: task,
      context: this.context,
      goal: this.goal
    });

    worker.process = spawn('node', [
      path.join(PROJ, '.kiro', 'swarm', 'worker-runner.js'),
      workerId,
      task.id,
      this.runId
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, SWARM_WORKER_ID: workerId, SWARM_TASK_ID: task.id }
    });

    let stdout = '';
    let stderr = '';

    worker.process.stdout.on('data', d => { stdout += d.toString(); });
    worker.process.stderr.on('data', d => { stderr += d.toString(); });

    worker.process.stdin.write(taskInput);
    worker.process.stdin.end();

    worker._done = new Promise(resolve => {
      const timeout = setTimeout(() => {
        worker.process.kill('SIGTERM');
        worker.status = 'timeout';
        worker.error = `Worker timed out after ${WORKER_TIMEOUT}ms`;
        worker.durationMs = Date.now() - workerStartMs;
        resolve(worker);
      }, WORKER_TIMEOUT);

      worker.process.on('close', code => {
        clearTimeout(timeout);
        worker.durationMs = Date.now() - workerStartMs;
        if (code === 0) {
          try { worker.result = JSON.parse(stdout); } catch { worker.result = stdout; }
          worker.status = 'ok';
        } else {
          worker.status = 'error';
          worker.error = stderr.slice(0, 2000) || `Exit code ${code}`;
        }
        resolve(worker);
      });

      worker.process.on('error', err => {
        clearTimeout(timeout);
        worker.status = 'error';
        worker.error = err.message;
        worker.durationMs = Date.now() - workerStartMs;
        resolve(worker);
      });
    });

    return worker;
  }

  async _awaitAnyWorker(workers) {
    const promises = workers.map(w => w._done.then(() => w));
    return Promise.race(promises);
  }
}

async function main() {
  const cmd = process.argv[2] || 'orchestrate';
  const raw = await readStdin();

  switch (cmd) {
    case 'orchestrate': {
      const input = parseInput(raw);
      const foreman = new Foreman(input);
      const result = await foreman.orchestrate();
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'decompose': {
      const input = parseInput(raw);
      const tasks = decomposeGoal(input.goal || input.description || '', input.context || {});
      console.log(JSON.stringify({ goal: input.goal, tasks }, null, 2));
      break;
    }
    case 'status': {
      const state = loadState();
      const lastRun = state.runs[state.runs.length - 1] || null;
      console.log(JSON.stringify({
        total_runs: state.runs.length,
        last_run: lastRun ? {
          id: lastRun.id,
          goal: lastRun.goal?.slice(0, 80),
          status: lastRun.status,
          tasks: lastRun.tasks?.length || 0,
          duration_ms: lastRun.duration_ms || null,
          started_at: lastRun.started_at
        } : null,
        worker_count: state.workers.length
      }, null, 2));
      break;
    }
    default:
      console.log('Commands: orchestrate | decompose | status');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
}

module.exports = { Foreman, decomposeGoal };
