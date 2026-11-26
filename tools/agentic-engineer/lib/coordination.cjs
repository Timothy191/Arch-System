'use strict';

/**
 * Team coordination control plane: prioritized task graph, assignments,
 * dependency-aware planning, progress tracking, and whiteboard conflict checks.
 */

const path = require('node:path');

const { nowIso, readJson, writeJson } = require('./util.cjs');

const STATUSES = ['queued', 'in_progress', 'blocked', 'done', 'failed'];
const OPEN_STATUSES = new Set(['queued', 'in_progress', 'blocked']);

function emptyState() {
  return { version: 1, nextId: 1, tasks: [] };
}

function normalizePriority(priority, priorities) {
  return priorities.includes(priority) ? priority : 'P2';
}

function loadState(stateDir, config) {
  const file = path.join(stateDir, config.state.tasksFile);
  const parsed = readJson(file, null);
  if (!parsed.ok || !parsed.value || !Array.isArray(parsed.value.tasks)) {
    return emptyState();
  }
  return {
    version: parsed.value.version || 1,
    nextId: Number.isInteger(parsed.value.nextId)
      ? parsed.value.nextId
      : parsed.value.tasks.length + 1,
    tasks: parsed.value.tasks,
  };
}

function saveState(stateDir, config, state) {
  writeJson(path.join(stateDir, config.state.tasksFile), state);
}

function findTask(state, taskId) {
  const task = state.tasks.find((entry) => entry.id === taskId);
  if (!task) throw new Error(`Unknown task "${taskId}"`);
  return task;
}

function touch(task, event, detail) {
  const timestamp = nowIso();
  task.updatedAt = timestamp;
  task.history = Array.isArray(task.history) ? task.history : [];
  task.history.push({ timestamp, event, detail: detail || '' });
}

function addTask(state, config, input = {}) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) throw new Error('Task title is required');
  const priorities = config.coordination.priorities;
  const priority = normalizePriority(input.priority, priorities);
  const dependsOn = Array.isArray(input.dependsOn) ? input.dependsOn : [];
  for (const dependency of dependsOn) {
    findTask(state, dependency);
  }
  const id = `ae-${String(state.nextId).padStart(4, '0')}`;
  state.nextId += 1;
  const task = {
    id,
    title,
    priority,
    status: 'queued',
    assignee: typeof input.assignee === 'string' && input.assignee ? input.assignee : null,
    component: typeof input.component === 'string' ? input.component : 'agent-content',
    targetFiles: Array.isArray(input.targetFiles) ? input.targetFiles : [],
    dependsOn,
    progress: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    history: [{ timestamp: nowIso(), event: 'created', detail: `priority ${priority}` }],
  };
  state.tasks.push(task);
  return task;
}

function assignTask(state, taskId, assignee) {
  const task = findTask(state, taskId);
  if (!assignee) throw new Error('Assignee is required');
  task.assignee = assignee;
  touch(task, 'assigned', assignee);
  return task;
}

function startTask(state, taskId) {
  const task = findTask(state, taskId);
  const incomplete = task.dependsOn.filter((dependency) => {
    const dep = state.tasks.find((entry) => entry.id === dependency);
    return dep?.status !== 'done';
  });
  if (incomplete.length > 0) {
    throw new Error(
      `Task ${taskId} is blocked by incomplete dependencies: ${incomplete.join(', ')}`
    );
  }
  task.status = 'in_progress';
  if (task.progress === 0) task.progress = 1;
  touch(task, 'started');
  return task;
}

function updateProgress(state, taskId, percent) {
  const task = findTask(state, taskId);
  const value = Number(percent);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('Progress must be a number between 0 and 100');
  }
  task.progress = value;
  if (value >= 100) {
    task.status = 'done';
  } else if (task.status === 'queued') {
    task.status = 'in_progress';
  }
  touch(task, 'progress', `${value}%`);
  return task;
}

function completeTask(state, taskId, result = '') {
  const task = findTask(state, taskId);
  task.progress = 100;
  task.status = 'done';
  touch(task, 'completed', result);
  return task;
}

function blockTask(state, taskId, reason = '') {
  const task = findTask(state, taskId);
  if (task.status === 'done') throw new Error(`Task ${taskId} is already complete`);
  task.status = 'blocked';
  touch(task, 'blocked', reason);
  return task;
}

function failTask(state, taskId, reason = '') {
  const task = findTask(state, taskId);
  task.status = 'failed';
  touch(task, 'failed', reason);
  return task;
}

function dependencyCycle(tasks) {
  const visit = new Map();
  const stack = [];
  const cycle = [];

  const walk = (taskId) => {
    if (visit.get(taskId) === 'done') return false;
    if (visit.get(taskId) === 'visiting') {
      cycle.push(...stack.slice(stack.indexOf(taskId)), taskId);
      return true;
    }
    visit.set(taskId, 'visiting');
    stack.push(taskId);
    const task = tasks.find((entry) => entry.id === taskId);
    for (const dependency of task ? task.dependsOn : []) {
      if (walk(dependency)) return true;
    }
    stack.pop();
    visit.set(taskId, 'done');
    return false;
  };

  for (const task of tasks) {
    if (walk(task.id)) return cycle;
  }
  return null;
}

function plan(state, config) {
  const tasks = state.tasks.filter((task) => OPEN_STATUSES.has(task.status));
  const cycle = dependencyCycle(state.tasks);
  if (cycle) return { ok: false, cycle, order: [], waiting: [] };

  const priorities = config.coordination.priorities;
  const rank = (task) => priorities.indexOf(task.priority);
  const done = new Set(state.tasks.filter((task) => task.status === 'done').map((task) => task.id));
  const remaining = new Map(tasks.map((task) => [task.id, task]));
  const order = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((task) => task.dependsOn.every((dependency) => done.has(dependency)))
      .sort(
        (a, b) =>
          rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
      );
    if (ready.length === 0) break;
    for (const task of ready) {
      order.push(task.id);
      done.add(task.id);
      remaining.delete(task.id);
    }
  }

  const waiting = [...remaining.values()].map((task) => ({
    id: task.id,
    missing: task.dependsOn.filter((dependency) => !done.has(dependency)),
  }));
  return { ok: waiting.length === 0, order, waiting, cycle: null };
}

function summary(state) {
  const total = state.tasks.length;
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  const byPriority = {};
  const assignments = {};
  let progressTotal = 0;
  for (const task of state.tasks) {
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
    const assignee = task.assignee || 'unassigned';
    assignments[assignee] = (assignments[assignee] || 0) + 1;
    progressTotal += Number(task.progress) || 0;
  }
  return {
    total,
    open: state.tasks.filter((task) => OPEN_STATUSES.has(task.status)).length,
    completionPercent: total === 0 ? 100 : Math.round((byStatus.done / total) * 1000) / 10,
    progressAverage: total === 0 ? 0 : Math.round((progressTotal / total) * 10) / 10,
    byStatus,
    byPriority,
    assignments,
    activeTasks: state.tasks.filter((task) => task.status === 'in_progress').map((task) => task.id),
    blocked: state.tasks.filter((task) => task.status === 'blocked').map((task) => task.id),
  };
}

function validateGraph(state, config) {
  const failures = [];
  const ids = new Set();
  for (const task of state.tasks) {
    if (ids.has(task.id)) failures.push(`duplicate task id ${task.id}`);
    ids.add(task.id);
    if (!STATUSES.includes(task.status))
      failures.push(`${task.id} has invalid status ${task.status}`);
    if (!config.coordination.priorities.includes(task.priority)) {
      failures.push(`${task.id} has invalid priority ${task.priority}`);
    }
    if (typeof task.progress !== 'number' || task.progress < 0 || task.progress > 100) {
      failures.push(`${task.id} has invalid progress ${task.progress}`);
    }
    for (const dependency of task.dependsOn || []) {
      if (!state.tasks.some((entry) => entry.id === dependency)) {
        failures.push(`${task.id} depends on missing task ${dependency}`);
      }
    }
  }
  const cycle = dependencyCycle(state.tasks);
  if (cycle) failures.push(`dependency cycle detected: ${cycle.join(' -> ')}`);
  return { ok: failures.length === 0, failures };
}

function claimConflicts(state, activeClaims) {
  const active = state.tasks.filter((task) => task.status === 'in_progress');
  const conflicts = [];
  for (const task of active) {
    for (const target of task.targetFiles || []) {
      for (const claim of activeClaims) {
        if (claim.filePath !== target) continue;
        if (claim.agentId && claim.agentId !== task.assignee) {
          conflicts.push({
            taskId: task.id,
            filePath: target,
            claimant: claim.agentId,
            assignee: task.assignee,
          });
        }
      }
    }
  }
  return conflicts;
}

module.exports = {
  STATUSES,
  addTask,
  assignTask,
  blockTask,
  claimConflicts,
  completeTask,
  failTask,
  findTask,
  loadState,
  plan,
  saveState,
  startTask,
  summary,
  updateProgress,
  validateGraph,
};
