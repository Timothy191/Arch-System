#!/usr/bin/env node
const queue = require('./queue');

const AGENT_REGISTRY = {
  scout: { model: 'default', tools: ['Read', 'Glob', 'Grep', 'Bash'], isolation: 'worktree' },
  debugger: { model: 'opus', tools: ['Read', 'Glob', 'Grep', 'Bash'], isolation: 'worktree' },
  planner: { model: 'default', tools: ['Read', 'Glob', 'Grep'] },
  'frontend-developer': { model: 'default', tools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash'] },
  reviewer: { model: 'default', tools: ['Read', 'Glob', 'Grep', 'Bash'] },
  'test-writer': { model: 'sonnet', tools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'] },
  'security-reviewer': { model: 'sonnet', tools: ['Read', 'Grep', 'Glob'] },
  'design-system-reviewer': { model: 'sonnet', tools: ['Read', 'Grep', 'Glob'] },
  'context-engineer': { model: 'default', tools: ['Read', 'Glob', 'Grep', 'Bash'] },
  'cost-analyst': { model: 'default', tools: ['Read', 'Glob', 'Grep', 'Bash'] },
};

const MAX_CONCURRENT = 4;
const STAGGER_MS = 2000;

module.exports = {
  getAgentConfig(agentType) {
    return AGENT_REGISTRY[agentType] || { model: 'default', tools: ['Read', 'Glob', 'Grep', 'Bash'] };
  },

  dispatchPlan(task) {
    const pending = queue.listTasks('pending');
    const running = queue.listTasks('running');
    const available = MAX_CONCURRENT - running.length;

    if (available <= 0) return [];

    const ready = [];
    for (const t of pending) {
      if (ready.length >= available) break;
      const depsMet = (t.dependencies || []).every(depId => {
        const dep = queue.listTasks().find(d => d.id === depId);
        return dep && dep.status === 'complete';
      });
      if (depsMet) {
        ready.push(t);
      }
    }

    return ready.map((t, i) => ({
      task: t,
      agent: AGENT_REGISTRY[t.agent_type] || AGENT_REGISTRY.scout,
      delay: i * STAGGER_MS
    }));
  },

  formatSubagentInstructions(task) {
    const agent = this.getAgentConfig(task.agent_type);
    return {
      agent_type: task.agent_type,
      tools: agent.tools,
      model: agent.model,
      instructions: [
        `Task: ${task.description}`,
        task.instructions ? `\nInstructions:\n${task.instructions}` : '',
        task.files?.length ? `\nFiles: ${task.files.join(', ')}` : '',
        '\nScope: Do not modify files outside the listed paths.',
        '\nReturn: summary of what was found/done.'
      ].join('\n')
    };
  }
};
