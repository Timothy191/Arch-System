#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const CIRCUIT_FILE = path.join(PROJ, '.kiro', 'swarm', 'circuit-breaker.json');
const STATE_FILE = path.join(PROJ, '.kiro', 'swarm', 'state.json');

const MAX_RETRIES = 3;
const CIRCUIT_THRESHOLD = 5; 
const CIRCUIT_RESET_MS = 30000;
const BACKOFF_MS = [1000, 4000, 10000];

function loadCircuit() {
  try {
    if (fs.existsSync(CIRCUIT_FILE)) return JSON.parse(fs.readFileSync(CIRCUIT_FILE, 'utf8'));
  } catch {}
  return { circuits: {} };
}

function saveCircuit(data) {
  try {
    const dir = path.dirname(CIRCUIT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CIRCUIT_FILE, JSON.stringify(data, null, 2));
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

class CircuitBreaker {
  constructor(name) {
    this.name = name;
    this.state = loadCircuit();
    if (!this.state.circuits[name]) {
      this.state.circuits[name] = { failures: 0, state: 'closed', last_failure: null, opened_at: null };
    }
    this.circuit = this.state.circuits[name];
  }

  allowRequest() {
    if (this.circuit.state === 'open') {
      const elapsed = Date.now() - (this.circuit.opened_at || 0);
      if (elapsed >= CIRCUIT_RESET_MS) {
        this.circuit.state = 'half-open';
        this.circuit.failures = 0;
        saveCircuit(this.state);
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.circuit.failures = 0;
    this.circuit.state = 'closed';
    this.circuit.opened_at = null;
    saveCircuit(this.state);
  }

  recordFailure() {
    this.circuit.failures++;
    this.circuit.last_failure = Date.now();
    if (this.circuit.failures >= CIRCUIT_THRESHOLD) {
      this.circuit.state = 'open';
      this.circuit.opened_at = Date.now();
    }
    saveCircuit(this.state);
  }

  status() {
    return { name: this.name, ...this.circuit };
  }
}

async function executeWithRetry(fn, options = {}) {
  const maxRetries = options.maxRetries || MAX_RETRIES;
  const name = options.name || 'default';
  const breaker = new CircuitBreaker(name);

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (!breaker.allowRequest()) {
      return {
        status: 'circuit_open',
        error: `Circuit breaker open for "${name}" (${Math.ceil((CIRCUIT_RESET_MS - (Date.now() - (breaker.circuit.opened_at || 0))) / 1000)}s remaining)`,
        attempt
      };
    }

    try {
      const result = await fn(attempt);
      breaker.recordSuccess();
      return { status: 'ok', result, attempt };
    } catch (err) {
      lastError = err;
      breaker.recordFailure();

      if (attempt < maxRetries) {
        const backoff = options.backoff?.[attempt] || BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        if (backoff > 0) {
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }
  }

  return { status: 'failed', error: lastError?.message || 'Max retries exceeded', attempt: maxRetries };
}

function recoverWorker(task, reason) {
  const state = loadState();
  const lastRun = state.runs[state.runs.length - 1];
  if (!lastRun) return null;

  const newTask = {
    ...task,
    id: `task_recovered_${Date.now()}`,
    description: `${task.description} [recovery: ${reason}]`,
    recovery_count: (task.recovery_count || 0) + 1
  };

  return newTask;
}

function getRecoveryStrategy(task, error) {
  const strategies = [
    { match: /timeout/i, action: 'increase_timeout', description: 'Increase worker timeout' },
    { match: /memory/i, action: 'reduce_load', description: 'Reduce task complexity' },
    { match: /network/i, action: 'retry_backoff', description: 'Retry with longer backoff' },
    { match: /not found/i, action: 'verify_prerequisites', description: 'Verify prerequisites exist' },
    { match: /permission/i, action: 'escalate_permissions', description: 'Escalate tool permissions' },
  ];

  if (!error) return { action: 'retry', description: 'Generic retry' };

  for (const s of strategies) {
    if (s.match.test(error)) return s;
  }
  return { action: 'retry', description: 'Generic retry' };
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {}
  return { runs: [], workers: [], next_id: 1 };
}

async function main() {
  const cmd = process.argv[2] || 'status';
  const raw = await readStdin();

  switch (cmd) {
    case 'execute': {
      const input = parseInput(raw);
      const fn = async () => {
        if (input.simulate_failure) throw new Error(input.simulate_failure);
        return { done: true, data: input.data };
      };
      const result = await executeWithRetry(fn, {
        name: input.name || 'task',
        maxRetries: input.maxRetries || MAX_RETRIES
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'status': {
      const circuit = loadCircuit();
      const statuses = Object.entries(circuit.circuits || {}).map(([name, c]) => ({
        name, state: c.state, failures: c.failures,
        opened_at: c.opened_at ? new Date(c.opened_at).toISOString() : null
      }));
      console.log(JSON.stringify({ circuits: statuses }, null, 2));
      break;
    }

    case 'reset': {
      const name = process.argv[3];
      const circuit = loadCircuit();
      if (name && circuit.circuits[name]) {
        circuit.circuits[name] = { failures: 0, state: 'closed', last_failure: null, opened_at: null };
        saveCircuit(circuit);
        console.log(JSON.stringify({ status: 'ok', circuit: name, action: 'reset' }));
      } else if (!name) {
        circuit.circuits = {};
        saveCircuit(circuit);
        console.log(JSON.stringify({ status: 'ok', action: 'reset_all' }));
      } else {
        console.log(JSON.stringify({ status: 'error', error: `Unknown circuit: ${name}` }));
      }
      break;
    }

    case 'strategy': {
      const input = parseInput(raw);
      const strategy = getRecoveryStrategy(input.task || {}, input.error || '');
      console.log(JSON.stringify({ strategy }, null, 2));
      break;
    }

    case 'recover': {
      const input = parseInput(raw);
      const recovered = recoverWorker(input.task || {}, input.reason || 'unknown');
      console.log(JSON.stringify({ recovered, recovery_count: recovered?.recovery_count || 0 }, null, 2));
      break;
    }

    default:
      console.log('Commands: execute | status | reset | strategy | recover');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
}

module.exports = { CircuitBreaker, executeWithRetry, getRecoveryStrategy, recoverWorker };
