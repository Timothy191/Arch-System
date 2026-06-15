#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WORKER_COUNT = parseInt(process.env.SCALE_WORKER_COUNT || '3', 10);
const QUEUE_FILE = path.join(PROJ, '.kiro', 'scale', 'queue.json');
const LOCK_DIR = path.join(PROJ, '.kiro', 'scale', 'locks');

function acquireLock(resource, ttlMs = 30000) {
  if (!fs.existsSync(LOCK_DIR)) fs.mkdirSync(LOCK_DIR, { recursive: true });
  const lockFile = path.join(LOCK_DIR, resource.replace(/[^a-zA-Z0-9_-]/g, '_') + '.lock');

  try {
    const exists = fs.existsSync(lockFile);
    if (exists) {
      const stat = fs.statSync(lockFile);
      const age = Date.now() - stat.mtimeMs;
      if (age < ttlMs) return false;
    }
    fs.writeFileSync(lockFile, JSON.stringify({ acquired_at: Date.now(), owner: process.pid }));
    return true;
  } catch { return false; }
}

function releaseLock(resource) {
  const lockFile = path.join(LOCK_DIR, resource.replace(/[^a-zA-Z0-9_-]/g, '_') + '.lock');
  try { fs.unlinkSync(lockFile); return true; }
  catch { return false; }
}

async function enqueue(task, queueName = 'default') {
  const queue = loadQueue(queueName);
  const entry = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    task,
    enqueued_at: Date.now(),
    status: 'pending',
    priority: task.priority || 5,
    attempts: 0
  };
  queue.push(entry);
  queue.sort((a, b) => (b.priority || 5) - (a.priority || 5));
  saveQueue(queueName, queue);
  return entry;
}

async function dequeue(queueName = 'default') {
  const queue = loadQueue(queueName);
  const idx = queue.findIndex(t => t.status === 'pending');
  if (idx === -1) return null;
  queue[idx].status = 'running';
  queue[idx].dequeued_at = Date.now();
  saveQueue(queueName, queue);
  return queue[idx];
}

async function completeTask(taskId, result, queueName = 'default') {
  const queue = loadQueue(queueName);
  const task = queue.find(t => t.id === taskId);
  if (!task) return false;
  task.status = 'completed';
  task.completed_at = Date.now();
  task.result = result;
  saveQueue(queueName, queue);
  return true;
}

async function failTask(taskId, error, queueName = 'default') {
  const queue = loadQueue(queueName);
  const task = queue.find(t => t.id === taskId);
  if (!task) return false;
  task.attempts++;
  if (task.attempts >= 3) {
    task.status = 'failed';
    task.error = error;
  } else {
    task.status = 'pending';
    task.error = error;
  }
  task.last_error_at = Date.now();
  saveQueue(queueName, queue);
  return true;
}

function loadQueue(name) {
  const file = path.join(PROJ, '.kiro', 'scale', `queue-${name}.json`);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return [];
}

function saveQueue(name, data) {
  const dir = path.dirname(QUEUE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(PROJ, '.kiro', 'scale', `queue-${name}.json`), JSON.stringify(data, null, 2));
}

function loadState() {
  const file = path.join(PROJ, '.kiro', 'scale', 'workers.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { workers: [] }; }
}

function saveState(data) {
  const dir = path.dirname(QUEUE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(PROJ, '.kiro', 'scale', 'workers.json'), JSON.stringify(data, null, 2));
}

function registerWorker(name, capabilities) {
  const state = loadState();
  state.workers = state.workers.filter(w => w.name !== name);
  state.workers.push({
    name,
    capabilities: capabilities || [],
    registered_at: Date.now(),
    last_heartbeat: Date.now(),
    status: 'active',
    current_load: 0,
    max_load: 3
  });
  saveState(state);
  return state.workers.length;
}

function assignWorker(task, requiredCapability) {
  const state = loadState();
  const available = state.workers.filter(w =>
    w.status === 'active' &&
    w.current_load < w.max_load &&
    (!requiredCapability || w.capabilities.includes(requiredCapability))
  );
  if (available.length === 0) return null;
  available.sort((a, b) => a.current_load - b.current_load);
  const worker = available[0];
  worker.current_load++;
  saveState(state);
  return worker;
}

function healthCheck() {
  const state = loadState();
  const now = Date.now();
  const stale = state.workers.filter(w => now - (w.last_heartbeat || 0) > 60000);

  for (const w of stale) {
    w.status = 'stale';
    w.current_load = 0;
  }

  const active = state.workers.filter(w => w.status === 'active').length;
  const total = state.workers.length;
  saveState(state);

  return { active, total, stale: stale.length, workers: state.workers.map(w => ({
    name: w.name, status: w.status, load: w.current_load, max: w.max_load
  })) };
}

async function main() {
  const cmd = process.argv[2] || 'status';

  switch (cmd) {
    case 'enqueue': {
      let raw = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', d => { raw += d; });
      process.stdin.on('end', async () => {
        try {
          const input = JSON.parse(raw || '{}');
          const queueName = process.argv[3] || 'default';
          const entry = await enqueue(input, queueName);
          console.log(JSON.stringify({ status: 'ok', task_id: entry.id, queue: queueName }));
        } catch (err) {
          console.error(JSON.stringify({ error: err.message }));
          process.exit(1);
        }
      });
      break;
    }

    case 'dequeue': {
      const queueName = process.argv[3] || 'default';
      const task = await dequeue(queueName);
      if (task) {
        console.log(JSON.stringify({ status: 'ok', task }));
      } else {
        console.log(JSON.stringify({ status: 'empty', queue: queueName }));
      }
      break;
    }

    case 'complete': {
      const taskId = process.argv[3];
      const queueName = process.argv[4] || 'default';
      if (!taskId) { console.error('Usage: scale complete <task_id> [queue]'); process.exit(1); }
      const result = await completeTask(taskId, {}, queueName);
      console.log(JSON.stringify({ status: result ? 'ok' : 'not_found' }));
      break;
    }

    case 'fail': {
      const taskId = process.argv[3];
      const error = process.argv[4] || 'unknown';
      const queueName = process.argv[5] || 'default';
      if (!taskId) { console.error('Usage: scale fail <task_id> <error> [queue]'); process.exit(1); }
      const result = await failTask(taskId, error, queueName);
      console.log(JSON.stringify({ status: result ? 'ok' : 'not_found', remaining: loadQueue(queueName).filter(t => t.status === 'pending').length }));
      break;
    }

    case 'register': {
      const name = process.argv[3];
      const caps = process.argv.slice(4);
      if (!name) { console.error('Usage: scale register <name> [capabilities...]'); process.exit(1); }
      const count = registerWorker(name, caps);
      console.log(JSON.stringify({ status: 'ok', worker: name, total_workers: count }));
      break;
    }

    case 'assign': {
      const task = process.argv[3] || '';
      const capability = process.argv[4] || null;
      const worker = assignWorker({ description: task }, capability);
      if (worker) {
        console.log(JSON.stringify({ status: 'ok', worker: worker.name, load: worker.current_load }));
      } else {
        console.log(JSON.stringify({ status: 'no_workers_available' }));
      }
      break;
    }

    case 'lock': {
      const resource = process.argv[3];
      const ttl = parseInt(process.argv[4] || '30000', 10);
      if (!resource) { console.error('Usage: scale lock <resource> [ttl_ms]'); process.exit(1); }
      const acquired = acquireLock(resource, ttl);
      console.log(JSON.stringify({ status: acquired ? 'acquired' : 'locked', resource }));
      break;
    }

    case 'unlock': {
      const resource = process.argv[3];
      if (!resource) { console.error('Usage: scale unlock <resource>'); process.exit(1); }
      const released = releaseLock(resource);
      console.log(JSON.stringify({ status: released ? 'released' : 'not_found', resource }));
      break;
    }

    case 'status': {
      const health = healthCheck();
      const queueFiles = [];
      try {
        const files = fs.readdirSync(path.dirname(QUEUE_FILE)).filter(f => f.startsWith('queue-'));
        for (const f of files) {
          const data = JSON.parse(fs.readFileSync(path.join(path.dirname(QUEUE_FILE), f), 'utf8'));
          queueFiles.push({
            name: f.replace('queue-', '').replace('.json', ''),
            pending: data.filter(t => t.status === 'pending').length,
            running: data.filter(t => t.status === 'running').length,
            completed: data.filter(t => t.status === 'completed').length,
            failed: data.filter(t => t.status === 'failed').length
          });
        }
      } catch {}
      console.log(JSON.stringify({
        workers: health,
        queues: queueFiles,
        lock_count: fs.existsSync(LOCK_DIR) ? fs.readdirSync(LOCK_DIR).length : 0
      }, null, 2));
      break;
    }

    default:
      console.log('Commands: enqueue | dequeue | complete | fail | register | assign | lock | unlock | status');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
}

module.exports = { enqueue, dequeue, acquireLock, releaseLock, registerWorker, assignWorker, healthCheck };
