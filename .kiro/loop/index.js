#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const STATE_FILE = path.join(__dirname, 'state.json');

const STATES = Object.freeze({
  IDLE: 'idle',
  ANALYZE: 'analyze',
  PLAN: 'plan',
  EXECUTE: 'execute',
  VERIFY: 'verify',
  REPORT: 'report',
  BLOCKED: 'blocked'
});

const TRANSITIONS = {
  [STATES.IDLE]: [STATES.ANALYZE],
  [STATES.ANALYZE]: [STATES.PLAN, STATES.BLOCKED],
  [STATES.PLAN]: [STATES.EXECUTE, STATES.ANALYZE, STATES.BLOCKED],
  [STATES.EXECUTE]: [STATES.VERIFY, STATES.PLAN, STATES.BLOCKED],
  [STATES.VERIFY]: [STATES.REPORT, STATES.EXECUTE, STATES.BLOCKED],
  [STATES.REPORT]: [STATES.IDLE],
  [STATES.BLOCKED]: [STATES.ANALYZE, STATES.IDLE]
};

function createInitialState() {
  return {
    session_id: 'ses_default',
    state: STATES.IDLE,
    current_task: null,
    queue: [],
    subagents: [],
    history: [],
    metrics: {
      tool_calls_total: 0,
      tokens_used: 0,
      subagents_dispatched: 0,
      errors: 0,
      session_start: new Date().toISOString()
    }
  };
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {}
  return createInitialState();
}

function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error(`[loop] Failed to save state: ${err.message}`);
  }
}

function getSessionId() {
  const raw = process.env.CLAUDE_SESSION_ID || String(process.ppid) || 'default';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

function checkInput() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    process.stdin.on('error', () => resolve({}));
  });
}

function validTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return allowed && allowed.includes(to);
}

async function main() {
  const state = loadState();
  const input = await checkInput();
  const hookType = process.env.HOOK_TYPE || 'postToolUse';
  const sessionId = getSessionId();

  state.session_id = sessionId;

  state.metrics.tool_calls_total++;

  if (hookType === 'subagentStop' && input.agent_name) {
    const idx = state.subagents.findIndex(s => s.agent === input.agent_name && s.status === 'running');
    if (idx !== -1) {
      state.subagents[idx].status = 'complete';
      state.subagents[idx].completed_at = new Date().toISOString();
      state.subagents[idx].result = input.result_summary || '';

      const allDone = state.subagents.every(s => s.status === 'complete' || s.status === 'failed');
      if (allDone && state.state === STATES.EXECUTE) {
        state.state = STATES.VERIFY;
      }
    }
  }

  if (hookType === 'subagentStart' && input.agent_name) {
    state.subagents.push({
      agent: input.agent_name,
      task: input.task_description || '',
      status: 'running',
      started_at: new Date().toISOString()
    });
    state.metrics.subagents_dispatched++;
  }

  if (hookType === 'sessionStart') {
    const elapsed = Date.now() - new Date(state.metrics.session_start).getTime();
    if (elapsed > 3600000) {
      state.history.push({ state: state.state, action: 'timeout_reset', at: new Date().toISOString() });
      Object.assign(state, createInitialState());
      state.session_id = sessionId;
    }
  }

  if (process.env.LOOP_DEBUG === '1') {
    console.error(`[loop] State: ${state.state} | Tool: ${input.tool || 'none'} | Queue: ${state.queue.length} | Subagents: ${state.subagents.filter(s => s.status === 'running').length} running`);
    if (state.current_task) {
      console.error(`[loop] Current task: ${state.current_task.description?.slice(0, 60)}`);
    }
  }

  saveState(state);

  const nextState = state.state;
  console.error(`[loop] state=${nextState} queue=${state.queue.length} subagents_running=${state.subagents.filter(s => s.status === 'running').length}`);

  process.exit(0);
}

main().catch(err => {
  console.error(`[loop] Fatal error: ${err.message}`);
  process.exit(1);
});
