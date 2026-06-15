#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const STATE_FILE = path.join(__dirname, 'state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {}
  return { queue: [], current_task: null };
}

function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

let taskCounter = 0;

function nextId() {
  taskCounter++;
  return `t-${Date.now().toString(36)}-${taskCounter}`;
}

module.exports = {
  addTask(description, opts = {}) {
    const state = loadState();
    const task = {
      id: nextId(),
      description,
      priority: opts.priority || 0,
      dependencies: opts.dependencies || [],
      status: 'pending',
      created_at: new Date().toISOString(),
      agent_type: opts.agent_type || null,
      files: opts.files || [],
      instructions: opts.instructions || description,
      result_summary: null
    };
    state.queue.push(task);
    state.queue.sort((a, b) => b.priority - a.priority);
    saveState(state);
    return task.id;
  },

  getNextTask() {
    const state = loadState();
    const ready = state.queue.filter(t => {
      if (t.status !== 'pending') return false;
      return t.dependencies.every(depId => {
        const dep = state.queue.find(d => d.id === depId);
        return dep && dep.status === 'complete';
      });
    });
    ready.sort((a, b) => b.priority - a.priority);
    return ready[0] || null;
  },

  claimTask(taskId) {
    const state = loadState();
    const task = state.queue.find(t => t.id === taskId);
    if (task && task.status === 'pending') {
      task.status = 'running';
      state.current_task = task;
      saveState(state);
      return true;
    }
    return false;
  },

  completeTask(taskId, result) {
    const state = loadState();
    const task = state.queue.find(t => t.id === taskId);
    if (task) {
      task.status = 'complete';
      task.result_summary = result || '';
      if (state.current_task && state.current_task.id === taskId) {
        state.current_task = null;
      }
      saveState(state);
      return true;
    }
    return false;
  },

  failTask(taskId, error) {
    const state = loadState();
    const task = state.queue.find(t => t.id === taskId);
    if (task) {
      task.status = 'failed';
      task.result_summary = `FAILED: ${error || 'unknown error'}`;
      saveState(state);
      return true;
    }
    return false;
  },

  listTasks(status) {
    const state = loadState();
    let tasks = state.queue;
    if (status) tasks = tasks.filter(t => t.status === status);
    return tasks;
  },

  clearCompleted() {
    const state = loadState();
    state.queue = state.queue.filter(t => t.status !== 'complete');
    saveState(state);
  },

  retryTask(taskId) {
    const state = loadState();
    const task = state.queue.find(t => t.id === taskId);
    if (task && task.status === 'failed') {
      task.status = 'pending';
      task.result_summary = null;
      saveState(state);
      return true;
    }
    return false;
  }
};
