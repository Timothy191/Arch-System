#!/usr/bin/env node
const queue = require('./queue');

const MAX_RETRIES = 3;
const BACKOFF_MS = [5000, 15000, 30000];

module.exports = {
  handleFailure(taskId, error) {
    const task = queue.listTasks().find(t => t.id === taskId);
    if (!task) return { action: 'ignore', reason: 'Task not found' };

    const retryCount = task._retryCount || 0;

    if (retryCount >= MAX_RETRIES) {
      queue.failTask(taskId, error);
      return {
        action: 'circuit_break',
        reason: `Max retries (${MAX_RETRIES}) exhausted for ${taskId}`,
        task
      };
    }

    const backoff = BACKOFF_MS[retryCount] || BACKOFF_MS[BACKOFF_MS.length - 1];
    task._retryCount = (retryCount + 1);
    task._retryAt = Date.now() + backoff;

    return {
      action: 'retry',
      reason: `Retry ${retryCount + 1}/${MAX_RETRIES} after ${backoff}ms backoff`,
      backoffMs: backoff,
      task
    };
  },

  handleRateLimit(taskId) {
    const task = queue.listTasks().find(t => t.id === taskId);
    if (!task) return { action: 'ignore' };

    return {
      action: 'cooldown',
      reason: 'Rate limited — cooling down for 30s',
      cooldownMs: 30000,
      task
    };
  },

  findCircuitBreaker(state) {
    const recentErrors = state.history?.filter(h =>
      h.action === 'failure' &&
      Date.now() - new Date(h.at).getTime() < 300000
    ) || [];

    if (recentErrors.length >= 5) {
      return {
        open: true,
        reason: `Circuit breaker open: ${recentErrors.length} errors in 5min`,
        cooldownMs: 60000
      };
    }

    return { open: false };
  },

  suggestFallback(task) {
    const fallbackMap = {
      'frontend-developer': 'reviewer',
      debugger: 'scout',
      test_writer: 'reviewer'
    };
    const fallbackAgent = fallbackMap[task.agent_type];
    if (fallbackAgent) {
      return {
        action: 'fallback',
        agent_type: fallbackAgent,
        reason: `Falling back from ${task.agent_type} to ${fallbackAgent}`
      };
    }
    return { action: 'report', reason: 'No fallback available for ' + task.agent_type };
  }
};
