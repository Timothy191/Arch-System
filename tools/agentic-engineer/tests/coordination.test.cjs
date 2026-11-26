'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { loadConfig } = require('../lib/constants.cjs');
const {
  addTask,
  assignTask,
  blockTask,
  claimConflicts,
  completeTask,
  failTask,
  plan,
  startTask,
  summary,
  updateProgress,
  validateGraph,
} = require('../lib/coordination.cjs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const { config } = loadConfig(ROOT);

function freshState() {
  return { version: 1, nextId: 1, tasks: [] };
}

test('addTask assigns sequential ids and normalizes priority', () => {
  const state = freshState();
  const first = addTask(state, config, { title: 'Draft spec', priority: 'P0' });
  const second = addTask(state, config, { title: 'Review spec', priority: 'bogus' });
  assert.equal(first.id, 'ae-0001');
  assert.equal(first.priority, 'P0');
  assert.equal(first.status, 'queued');
  assert.equal(second.id, 'ae-0002');
  assert.equal(second.priority, 'P2');
  assert.throws(() => addTask(state, config, { title: '  ' }), /title is required/);
});

test('addTask rejects unknown dependencies', () => {
  const state = freshState();
  assert.throws(
    () => addTask(state, config, { title: 'Orphan', dependsOn: ['ae-9999'] }),
    /Unknown task "ae-9999"/
  );
});

test('startTask blocks on incomplete dependencies and progresses after completion', () => {
  const state = freshState();
  const dependency = addTask(state, config, { title: 'Schema', priority: 'P0' });
  const dependent = addTask(state, config, {
    title: 'Consumer',
    priority: 'P1',
    dependsOn: [dependency.id],
  });
  assert.throws(() => startTask(state, dependent.id), /incomplete dependencies/);

  const blockedPlan = plan(state, config);
  assert.equal(blockedPlan.ok, true);
  assert.deepEqual(blockedPlan.order, [dependency.id, dependent.id]);
  assert.deepEqual(blockedPlan.waiting, []);

  completeTask(state, dependency.id, 'done');
  const readyPlan = plan(state, config);
  assert.equal(readyPlan.ok, true);
  assert.deepEqual(readyPlan.order, [dependent.id]);

  startTask(state, dependent.id);
  assert.equal(dependent.status, 'in_progress');
  assert.equal(dependent.progress, 1);
});

test('updateProgress transitions status and rejects out-of-range values', () => {
  const state = freshState();
  const task = addTask(state, config, { title: 'Track', priority: 'P1' });
  updateProgress(state, task.id, 45);
  assert.equal(task.status, 'in_progress');
  updateProgress(state, task.id, 100);
  assert.equal(task.status, 'done');
  assert.throws(() => updateProgress(state, task.id, 101), /between 0 and 100/);
});

test('block, fail, and assign mutate status and assignee', () => {
  const state = freshState();
  const task = addTask(state, config, { title: 'Handle', priority: 'P2' });
  assignTask(state, task.id, 'critique-council-reviewer');
  assert.equal(task.assignee, 'critique-council-reviewer');
  blockTask(state, task.id, 'waiting on schema');
  assert.equal(task.status, 'blocked');
  failTask(state, task.id, 'schema rejected');
  assert.equal(task.status, 'failed');
  const finished = addTask(state, config, { title: 'Finished', priority: 'P3' });
  completeTask(state, finished.id);
  assert.throws(() => blockTask(state, finished.id, 'nope'), /already complete/);
});

test('validateGraph detects cycles and missing dependencies', () => {
  const state = freshState();
  const first = addTask(state, config, { title: 'A', priority: 'P1' });
  const second = addTask(state, config, { title: 'B', priority: 'P1', dependsOn: [first.id] });
  first.dependsOn = [second.id];
  const result = validateGraph(state, config);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('cycle')));
  assert.equal(plan(state, config).ok, false);

  const broken = freshState();
  const orphan = addTask(broken, config, { title: 'C', priority: 'P1' });
  orphan.dependsOn = ['ae-4040'];
  assert.ok(
    validateGraph(broken, config).failures.some((failure) => failure.includes('missing task'))
  );
});

test('claimConflicts reports whiteboard overlaps for active tasks', () => {
  const state = freshState();
  const task = addTask(state, config, {
    title: 'Edit agent',
    priority: 'P0',
    assignee: 'agentic-engineer',
    targetFiles: ['.agents/agents/example/agent.md'],
  });
  startTask(state, task.id);
  const conflicting = claimConflicts(state, [
    { agentId: 'security-quality-gatekeeper', filePath: '.agents/agents/example/agent.md' },
  ]);
  assert.equal(conflicting.length, 1);
  assert.equal(conflicting[0].claimant, 'security-quality-gatekeeper');
  const overlapping = claimConflicts(state, [
    { agentId: 'agentic-engineer', filePath: '.agents/agents/example/agent.md' },
  ]);
  assert.equal(overlapping.length, 0);
});

test('summary reports open work, assignments, and progress average', () => {
  const state = freshState();
  const first = addTask(state, config, {
    title: 'One',
    priority: 'P0',
    assignee: 'agentic-engineer',
  });
  addTask(state, config, { title: 'Two', priority: 'P3' });
  completeTask(state, first.id);
  const overview = summary(state);
  assert.equal(overview.total, 2);
  assert.equal(overview.open, 1);
  assert.equal(overview.byStatus.done, 1);
  assert.equal(overview.progressAverage, 50);
  assert.equal(overview.assignments['agentic-engineer'], 1);
  assert.equal(overview.assignments.unassigned, 1);
});
