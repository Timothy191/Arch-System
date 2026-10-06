#!/usr/bin/env node

/**
 * @fileoverview Agent Workflow Wrapper
 * Orchestrates pre-task checks, task execution, and post-task tracking
 *
 * Usage: node tools/scripts/agent-workflow-wrapper.cjs --task <task-description> --agent <agent-type>
 *
 * Example:
 *   node tools/scripts/agent-workflow-wrapper.cjs --task "Fix login bug" --agent devin
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_DIR = path.join(ROOT, '.agents', 'memory_base');
const WORKFLOW_LOG = path.join(MEMORY_DIR, 'workflow-log.json');

function logWorkflowEntry(entry) {
  const logs = [];
  if (fs.existsSync(WORKFLOW_LOG)) {
    try {
      const existing = JSON.parse(fs.readFileSync(WORKFLOW_LOG, 'utf-8'));
      logs.push(...existing);
    } catch (e) {
      console.warn('⚠️ Failed to load workflow log');
    }
  }

  logs.push(entry);

  // Keep only last 50 entries
  if (logs.length > 50) {
    logs.splice(0, logs.length - 50);
  }

  fs.writeFileSync(WORKFLOW_LOG, JSON.stringify(logs, null, 2), 'utf-8');
}

function main() {
  const args = process.argv.slice(2);
  const taskIdx = args.indexOf('--task');
  const agentIdx = args.indexOf('--agent');
  const skipBudgetIdx = args.indexOf('--skip-budget-check');

  const task = taskIdx !== -1 && args[taskIdx + 1] ? args[taskIdx + 1] : 'unknown';
  const agent = agentIdx !== -1 && args[agentIdx + 1] ? args[agentIdx + 1] : 'unknown';
  const skipBudgetCheck = skipBudgetIdx !== -1;

  const startTime = Date.now();

  console.log('🤖 [Agent Workflow Wrapper] Starting task execution\n');
  console.log(`📋 Task: ${task}`);
  console.log(`🤖 Agent: ${agent}`);
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);

  // Pre-task checks
  console.log('🔍 [Pre-Task] Running quality gates...\n');

  try {
    // Context budget check
    if (!skipBudgetCheck) {
      console.log('💰 Checking context budget...');
      execSync('pnpm token:budget-check', { cwd: ROOT, stdio: 'inherit' });
      console.log('✅ Context budget within limits\n');
    } else {
      console.log('⚠️ Skipping budget check\n');
    }

    // Type check
    console.log('⚙️  Type checking...');
    execSync('pnpm type-check', { cwd: ROOT, stdio: 'inherit' });
    console.log('✅ Type check passed\n');

    // Lint check
    console.log('🧹 Linting...');
    execSync('pnpm lint', { cwd: ROOT, stdio: 'inherit' });
    console.log('✅ Linting passed\n');

    // Policy check
    console.log('🛡️  Checking architectural boundaries...');
    execSync('pnpm policy:check', { cwd: ROOT, stdio: 'inherit' });
    console.log('✅ Architectural boundaries valid\n');
  } catch (error) {
    console.error('\n❌ [Pre-Task] Quality gates failed');
    console.error('💡 Fix the errors above before proceeding with the task\n');

    logWorkflowEntry({
      task,
      agent,
      status: 'failed-pre-check',
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: error.message,
    });

    process.exit(1);
  }

  console.log('✅ [Pre-Task] All quality gates passed\n');
  console.log('🚀 [Agent Workflow Wrapper] Ready for agent execution\n');
  console.log('========================================================\n');

  // The actual agent task would be executed here
  // This wrapper is designed to be called before running the agent
  // The agent orchestrator should handle the actual task execution

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log('\n========================================================\n');
  console.log('🎉 [Agent Workflow Wrapper] Pre-task checks complete\n');
  console.log(`⏰ Duration: ${(duration / 1000).toFixed(2)}s\n`);

  logWorkflowEntry({
    task,
    agent,
    status: 'pre-check-complete',
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    duration,
  });

  console.log('💡 [Agent Workflow Wrapper] Run your agent task now\n');
  console.log('After completion, run: pnpm agent:hook:post-task\n');
}

if (require.main === module) {
  main();
}

module.exports = { logWorkflowEntry };
