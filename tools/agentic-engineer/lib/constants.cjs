'use strict';

const path = require('node:path');

const { isInside, readJson } = require('./util.cjs');

const DEFAULT_CONFIG = {
  version: 1,
  instance: {
    name: 'agentic-engineer',
    agentPath: '.agents/agents/agentic-engineer/agent.md',
    registryPath: '.agents/a2a/registry/agentic-engineer.json',
  },
  agentContent: {
    roots: [
      '.agents/agents',
      '.agents/a2a',
      '.agents/rules',
      '.agents/hooks',
      '.agents/hooks.json',
      '.agents/skills',
      '.agents/skills.json',
      '.qoder/agents',
      '.qoder/skills',
      '.qoder/hooks',
      '.cursor/rules',
      'AGENTS.md',
      'GEMINI.md',
      'CLAUDE.md',
      'AGENT_TRACER.md',
    ],
    runtimeExcludes: ['.agents/a2a/bus', '.agents/a2a/whiteboard', '.agents/memory_base'],
  },
  documentation: {
    root: 'docs/agents/agentic-engineer',
    required: [],
    catalog: 'documentation/07-agentic-systems/agentic-engineer-catalog.md',
    healthReport: 'documentation/03-audit-reports/agentic-engineer-health.md',
  },
  thresholds: { interopScore: 100, docsCompleteness: 100 },
  state: {
    dir: '.ci-local/agentic-engineer',
    tasksFile: 'tasks.json',
    ledgerFile: 'audit-ledger.jsonl',
    alertsFile: 'alerts.jsonl',
    healthFile: 'health.json',
    heartbeatFile: 'heartbeat.json',
  },
  coordination: { defaultAssignee: 'agentic-engineer', priorities: ['P0', 'P1', 'P2', 'P3'] },
  alerts: { webhookEnv: 'AGENTIC_ENGINEER_WEBHOOK_URL' },
};

const CONFIG_REL = '.agents/agentic-engineer/config.json';

function deepMerge(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge(base[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function loadConfig(root) {
  const loaded = readJson(path.join(root, CONFIG_REL), null);
  const config =
    loaded.ok && loaded.value ? deepMerge(DEFAULT_CONFIG, loaded.value) : DEFAULT_CONFIG;
  const stateDir = process.env.AGENTIC_ENGINEER_STATE_DIR
    ? path.resolve(process.env.AGENTIC_ENGINEER_STATE_DIR)
    : path.join(root, config.state.dir);
  return { config, stateDir, configPath: path.join(root, CONFIG_REL), configLoaded: loaded.ok };
}

function isAgentContentPath(relPath, config) {
  const excludes = config.agentContent.runtimeExcludes || [];
  if (isInside(relPath, excludes)) return false;
  return isInside(relPath, config.agentContent.roots || []);
}

module.exports = { CONFIG_REL, DEFAULT_CONFIG, isAgentContentPath, loadConfig };
