#!/usr/bin/env node

/**
 * @fileoverview Post-Task Token Usage Tracking Hook
 * Records token usage, latency, and bugs resolved after task completion,
 * delegating to tools/scripts/token-tracker.cjs (canonical build telemetry).
 *
 * Usage: Called automatically by agent orchestration systems after task execution
 *   TASK_TAG="feat: xyz" TASK_DURATION="420" TASK_BUGS_RESOLVED=3 \
 *     node .agents/hooks/post-task-token-track.cjs
 *
 * Env inputs:
 *   TASK_TAG            - task identifier / commit subject (default: 'unknown')
 *   TASK_DURATION       - wall-clock seconds for the task (default: '0')
 *   TASK_PAYLOAD        - raw prompt/context payload; BPE-counted when gpt-tokenizer is available
 *   TASK_AGENT          - agent name (default: OMG_WORKER_NAME or 'claude-code-agent')
 *   TASK_MODEL          - model id (default: 'claude-sonnet-4')
 *   TASK_BUGS_RESOLVED  - integer count of bugs fixed in this task (default: 0)
 *   TASK_TURNS          - number of reasoning turns (default: 1)
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const TRACKER = path.join(ROOT, 'tools', 'scripts', 'token-tracker.cjs');

function main() {
  const taskTag = process.env.TASK_TAG || 'unknown';
  const taskDuration = process.env.TASK_DURATION || '0';
  const taskPayload = process.env.TASK_PAYLOAD || '';
  const agent = process.env.TASK_AGENT || process.env.OMG_WORKER_NAME || 'claude-code-agent';
  const model = process.env.TASK_MODEL || 'claude-sonnet-4';
  const bugsResolved = Math.max(0, parseInt(process.env.TASK_BUGS_RESOLVED || '0', 10) || 0);
  const turns = Math.max(1, parseInt(process.env.TASK_TURNS || '1', 10) || 1);

  let countTokensFn = null;
  try {
    countTokensFn = require('gpt-tokenizer').countTokens;
  } catch {
    try {
      countTokensFn = require(
        path.resolve(__dirname, '../../../skills-mcp/node_modules/gpt-tokenizer')
      ).countTokens;
    } catch {
      countTokensFn = null;
    }
  }

  // Input ≈ payload context; output ≈ duration-scaled emission heuristic.
  // Both are recorded so the Claude Code cost model (input/output/cache split)
  // in token-tracker.cjs sees real per-session values.
  const inputTokens =
    taskPayload && countTokensFn
      ? countTokensFn(taskPayload)
      : Math.max(500, Math.floor(parseInt(taskDuration, 10) * 40));
  const outputTokens = Math.max(120, Math.floor(parseInt(taskDuration, 10) * 18));
  const cachedTokens = Math.floor(inputTokens * 0.84);
  const latencyMs = Math.max(200, Math.floor((parseInt(taskDuration, 10) * 1000) / turns));

  const result = spawnSync(
    process.execPath,
    [
      TRACKER,
      'record',
      '--agent',
      agent,
      '--model',
      model,
      '--input',
      String(inputTokens),
      '--cached',
      String(cachedTokens),
      '--output',
      String(outputTokens),
      '--latency',
      String(latencyMs),
      '--bugs',
      String(bugsResolved),
      '--turns',
      String(turns),
      '--task',
      taskTag,
    ],
    { cwd: ROOT, encoding: 'utf-8' }
  );

  if (result.status !== 0) {
    console.warn(
      `⚠️ [Post-Task Hook] token-tracker record failed (exit ${result.status}):`,
      result.stderr?.trim() || 'no stderr'
    );
    process.exitCode = 0; // Telemetry must never block the agent lifecycle
    return;
  }

  console.log(
    `💰 [Post-Task Hook] Recorded ${agent}: ~${inputTokens + outputTokens} tokens (${bugsResolved} bugs fixed)`
  );
  const lastLine = (result.stdout || '').trim().split('\n').pop();
  if (lastLine) console.log(`   ${lastLine}`);
}

main();
