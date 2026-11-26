#!/usr/bin/env node
'use strict';

/**
 * Agentic Engineer control-plane CLI.
 *
 * Commands:
 *   init | validate | docs | health | gate | status | watch | audit
 *   coordinate <add|assign|start|progress|complete|block|fail|plan|list|status|sync|validate>
 */

const fs = require('node:fs');
const path = require('node:path');

const { appendBusEvent, buildBusEvent, buildHeartbeat } = require('../lib/a2a.cjs');
const { isAgentContentPath, loadConfig } = require('../lib/constants.cjs');
const {
  addTask,
  assignTask,
  blockTask,
  claimConflicts,
  completeTask,
  failTask,
  loadState,
  plan,
  saveState,
  startTask,
  summary,
  updateProgress,
  validateGraph,
} = require('../lib/coordination.cjs');
const { evaluateDocs, writeCatalog } = require('../lib/docs-governance.cjs');
const { changedFiles } = require('../lib/git.cjs');
const { runInteropValidation } = require('../lib/interop-validator.cjs');
const {
  appendLedger,
  emitAlert,
  runHealth,
  verifyLedger,
  writeHealthReport,
} = require('../lib/monitoring.cjs');
const { ensureDir, readJson } = require('../lib/util.cjs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const EXIT = { OK: 0, FAIL: 1, DEGRADED: 2, USAGE: 3 };

function parseFlags(tokens) {
  const flags = {};
  const positional = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') continue;
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const equals = token.indexOf('=');
    if (equals !== -1) {
      flags[token.slice(2, equals)] = token.slice(equals + 1);
      continue;
    }
    const key = token.slice(2);
    const next = tokens[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return { flags, positional };
}

function line(status, message) {
  const tag = status === 'pass' ? '[PASS]' : status === 'warn' ? '[WARN]' : '[FAIL]';
  console.log(`${tag} ${message}`);
}

function splitList(value) {
  if (!value || value === true) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function printValidation(result, quiet) {
  if (!quiet) {
    for (const entry of result.checks) {
      line(entry.status, `${entry.id} — ${entry.title}`);
      for (const failure of entry.failures) console.log(`       ${failure}`);
    }
  }
  if (result.ok) {
    line('pass', `Interoperability ${result.score}% (${result.passed}/${result.total} checks)`);
  } else {
    line('fail', `Interoperability ${result.score}% (${result.failed} failing checks)`);
  }
}

function deploymentCheck(root, config) {
  const failures = [];
  const agentPath = path.join(root, config.instance.agentPath);
  const registryPath = path.join(root, config.instance.registryPath);
  if (!fs.existsSync(agentPath)) failures.push(`missing ${config.instance.agentPath}`);
  if (!fs.existsSync(registryPath)) {
    failures.push(`missing ${config.instance.registryPath}`);
  } else {
    const registry = readJson(registryPath, null);
    if (!registry.ok) failures.push(`${config.instance.registryPath} is invalid JSON`);
    else if (registry.value.name !== config.instance.name) {
      failures.push(`${config.instance.registryPath} name does not match the instance`);
    }
  }
  return { ok: failures.length === 0, failures };
}

function buildGateReport(root, config, mode) {
  const files = changedFiles(root, mode);
  const interop = runInteropValidation(root);
  const docs = evaluateDocs({ root, config, changedFiles: files });
  const deployment = deploymentCheck(root, config);
  const agentChanges = files.filter((file) => isAgentContentPath(file, config));
  return {
    ok: interop.ok && docs.ok && deployment.ok,
    mode,
    changedFiles: files,
    agentChanges,
    interop,
    docs,
    deployment,
  };
}

function printGateReport(report, quiet) {
  if (!quiet) {
    printValidation(report.interop, quiet);
    for (const check of report.docs.checks) {
      line(
        check.ok ? 'pass' : 'fail',
        `docs.${check.id}${check.ok ? '' : ` — ${check.failures[0]}`}`
      );
    }
    if (!report.deployment.ok) {
      for (const failure of report.deployment.failures) line('fail', `deployment — ${failure}`);
    }
  }
  const changed = report.agentChanges.length;
  line(
    report.ok ? 'pass' : 'fail',
    `Gate ${report.mode}: ${changed} agent-content change(s), ` +
      `interop ${report.interop.score}%, docs ${report.docs.completeness}%`
  );
}

function cmdInit(root, config, stateDir) {
  ensureDir(stateDir);
  const tasksPath = path.join(stateDir, config.state.tasksFile);
  if (!fs.existsSync(tasksPath)) {
    saveState(stateDir, config, { version: 1, nextId: 1, tasks: [] });
  }
  const report = buildGateReport(root, config, 'working');
  printGateReport(report, false);
  appendLedger({
    stateDir,
    config,
    action: 'INIT',
    subject: config.instance.name,
    result: report.ok ? 'ok' : 'failed',
    detail: { interop: report.interop.score, docs: report.docs.completeness },
  });
  return report.ok ? EXIT.OK : EXIT.FAIL;
}

function cmdValidate(root, config, flags) {
  const result = runInteropValidation(root);
  if (flags.json) {
    console.log(JSON.stringify({ score: result.score, checks: result.checks }, null, 2));
  } else {
    printValidation(result, flags.quiet);
  }
  return result.ok ? EXIT.OK : EXIT.FAIL;
}

function cmdDocs(root, config, flags) {
  if (flags.write) {
    const { path: catalogPath } = writeCatalog(root, config);
    console.log(`Wrote ${catalogPath}`);
  }
  const mode = flags.staged ? 'staged' : 'changed';
  const files = changedFiles(root, mode);
  const result = evaluateDocs({ root, config, changedFiles: files });
  for (const check of result.checks) {
    line(check.ok ? 'pass' : 'fail', `docs.${check.id} — ${check.type}`);
    for (const failure of check.failures) console.log(`       ${failure}`);
  }
  line(result.ok ? 'pass' : 'fail', `Documentation completeness ${result.completeness}%`);
  if (flags.json) console.log(JSON.stringify(result, null, 2));
  return result.ok ? EXIT.OK : EXIT.FAIL;
}

async function cmdHealth(root, config, stateDir, flags) {
  const health = await runHealth({ root, stateDir, config });
  if (flags.write) {
    const report = writeHealthReport(root, config, health);
    console.log(`Wrote ${report.path}`);
  }
  appendLedger({
    stateDir,
    config,
    action: 'HEALTH_CHECK',
    subject: config.instance.name,
    result: health.status,
    detail: {
      interop: health.interop.score,
      docs: health.documentation.completeness,
      alerts: health.alerts.length,
    },
  });
  if (flags.json) {
    console.log(JSON.stringify(health, null, 2));
  } else {
    console.log(
      `[${health.status.toUpperCase()}] interop ${health.interop.score}% | ` +
        `docs ${health.documentation.completeness}% | alerts ${health.alerts.length}`
    );
    for (const alert of health.alerts) {
      console.log(`  - ${alert.severity}: ${alert.checkId} — ${alert.message}`);
    }
  }
  if (health.status === 'healthy') return EXIT.OK;
  return health.status === 'degraded' ? EXIT.DEGRADED : EXIT.FAIL;
}

function cmdGate(root, config, flags) {
  const mode = flags.staged ? 'staged' : flags.ci ? 'ci' : 'working';
  const report = buildGateReport(root, config, mode);
  printGateReport(report, flags.quiet);
  if (flags.json) console.log(JSON.stringify(report, null, 2));
  return report.ok ? EXIT.OK : EXIT.FAIL;
}

function recordCoordination(root, stateDir, config, task, action, detail) {
  appendLedger({
    stateDir,
    config,
    action,
    subject: task.id,
    result: task.status,
    detail: { title: task.title, ...detail },
  });
  const eventType = `TASK_${action.replace(/^TASK_/, '')}`;
  appendBusEvent(
    path.join(root, '.agents', 'a2a', 'bus'),
    buildBusEvent({
      eventType,
      sender: config.instance.name,
      recipient: task.assignee || 'unassigned',
      taskId: task.id,
      payloadSummary: `${task.title} (${task.status})`,
    })
  );
  return eventType;
}

function cmdCoordinate(root, config, stateDir, flags, positional) {
  const subcommand = positional[0] || 'status';
  const state = loadState(stateDir, config);
  const save = () => saveState(stateDir, config, state);
  const id = positional[1];
  let task = null;

  switch (subcommand) {
    case 'init':
      save();
      appendLedger({ stateDir, config, action: 'COORDINATION_INIT', subject: 'tasks' });
      console.log(`Initialized coordination state at ${config.state.dir}`);
      return EXIT.OK;
    case 'add': {
      task = addTask(state, config, {
        title: flags.title,
        priority: flags.priority,
        assignee: flags.assignee,
        component: flags.component,
        dependsOn: splitList(flags['depends-on']),
        targetFiles: splitList(flags['target-files']),
      });
      save();
      recordCoordination(root, stateDir, config, task, 'CREATED', { priority: task.priority });
      console.log(`${task.id} queued: ${task.title} [${task.priority}]`);
      return EXIT.OK;
    }
    case 'assign':
      task = assignTask(state, id, flags.assignee);
      save();
      recordCoordination(root, stateDir, config, task, 'ASSIGNED', { assignee: task.assignee });
      console.log(`${task.id} assigned to ${task.assignee}`);
      return EXIT.OK;
    case 'start':
      task = startTask(state, id);
      save();
      recordCoordination(root, stateDir, config, task, 'STARTED', {});
      console.log(`${task.id} started`);
      return EXIT.OK;
    case 'progress':
      task = updateProgress(state, id, flags.percent);
      save();
      recordCoordination(root, stateDir, config, task, 'PROGRESS', { progress: task.progress });
      console.log(`${task.id} progress ${task.progress}% (${task.status})`);
      return EXIT.OK;
    case 'complete':
      task = completeTask(state, id, flags.result);
      save();
      recordCoordination(root, stateDir, config, task, 'COMPLETED', {});
      console.log(`${task.id} completed`);
      return EXIT.OK;
    case 'block':
      task = blockTask(state, id, flags.reason);
      save();
      recordCoordination(root, stateDir, config, task, 'BLOCKED', { reason: flags.reason });
      console.log(`${task.id} blocked`);
      return EXIT.OK;
    case 'fail':
      task = failTask(state, id, flags.reason);
      save();
      recordCoordination(root, stateDir, config, task, 'FAILED', { reason: flags.reason });
      console.log(`${task.id} failed`);
      return EXIT.OK;
    case 'plan': {
      const result = plan(state, config);
      if (flags.json) console.log(JSON.stringify(result, null, 2));
      else if (!result.ok) {
        console.log(
          `Plan blocked: ${result.cycle ? `cycle ${result.cycle.join(' -> ')}` : 'waiting tasks'}`
        );
        for (const entry of result.waiting)
          console.log(`  ${entry.id} needs ${entry.missing.join(', ')}`);
      } else {
        console.log(result.order.length > 0 ? result.order.join(' -> ') : 'No open tasks.');
      }
      return result.ok ? EXIT.OK : EXIT.FAIL;
    }
    case 'list': {
      if (flags.json) console.log(JSON.stringify(state.tasks, null, 2));
      else {
        for (const entry of state.tasks) {
          console.log(
            `${entry.id} [${entry.priority}] ${entry.status.padEnd(11)} ` +
              `${String(entry.progress).padStart(3)}% ${entry.title}`
          );
        }
      }
      return EXIT.OK;
    }
    case 'status': {
      const overview = summary(state);
      if (flags.json) console.log(JSON.stringify(overview, null, 2));
      else {
        console.log(
          `Tasks ${overview.total} | open ${overview.open} | done ${overview.byStatus.done} | ` +
            `avg progress ${overview.progressAverage}%`
        );
        console.log(`Assignments: ${JSON.stringify(overview.assignments)}`);
        if (overview.blocked.length > 0) console.log(`Blocked: ${overview.blocked.join(', ')}`);
      }
      return EXIT.OK;
    }
    case 'sync': {
      const claims = readJson(path.join(root, '.agents', 'a2a', 'whiteboard', 'claims.json'), null);
      const activeClaims =
        claims.ok && Array.isArray(claims.value?.activeClaims) ? claims.value.activeClaims : [];
      const conflicts = claimConflicts(state, activeClaims);
      const heartbeat = buildHeartbeat({
        agentId: config.instance.name,
        status: summary(state).activeTasks.length > 0 ? 'ACTIVE' : 'IDLE',
        activeTasks: summary(state).activeTasks,
        memoryUsageMb: Math.round(process.memoryUsage().rss / 1048576),
      });
      const heartbeatPath = path.join(stateDir, config.state.heartbeatFile);
      ensureDir(stateDir);
      fs.writeFileSync(heartbeatPath, `${JSON.stringify({ ...heartbeat, conflicts }, null, 2)}\n`);
      appendBusEvent(
        path.join(root, '.agents', 'a2a', 'bus'),
        buildBusEvent({
          eventType: 'STATUS_HEARTBEAT',
          sender: heartbeat.agentId,
          recipient: 'orchestrator',
          payloadSummary: `${heartbeat.status} with ${heartbeat.activeTasks.length} active task(s)`,
        })
      );
      appendLedger({
        stateDir,
        config,
        action: 'COORDINATION_SYNC',
        subject: 'heartbeat',
        result: conflicts.length === 0 ? 'ok' : 'conflict',
        detail: { activeTasks: heartbeat.activeTasks, conflicts },
      });
      console.log(`Heartbeat ${heartbeat.status}; ${conflicts.length} claim conflict(s).`);
      for (const conflict of conflicts) {
        console.log(
          `  ${conflict.taskId} wants ${conflict.filePath} claimed by ${conflict.claimant}`
        );
      }
      return conflicts.length === 0 ? EXIT.OK : EXIT.FAIL;
    }
    case 'validate': {
      const result = validateGraph(state, config);
      for (const failure of result.failures) console.log(`  ${failure}`);
      line(result.ok ? 'pass' : 'fail', `Task graph ${result.ok ? 'valid' : 'invalid'}`);
      return result.ok ? EXIT.OK : EXIT.FAIL;
    }
    default:
      console.error(`Unknown coordinate subcommand "${subcommand}"`);
      return EXIT.USAGE;
  }
}

function cmdAudit(config, stateDir, flags) {
  const ledgerPath = path.join(stateDir, config.state.ledgerFile);
  const result = verifyLedger(ledgerPath);
  if (flags.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const failure of result.failures) console.log(`  ${failure}`);
    line(
      result.ok ? 'pass' : 'fail',
      `Audit ledger ${result.ok ? 'verified' : 'corrupt'} (${result.entries} entries)`
    );
  }
  return result.ok ? EXIT.OK : EXIT.FAIL;
}

function cmdStatus(root, config, stateDir) {
  const interop = runInteropValidation(root);
  const docs = evaluateDocs({ root, config });
  const deployment = deploymentCheck(root, config);
  const state = loadState(stateDir, config);
  const overview = summary(state);
  line(
    interop.ok ? 'pass' : 'fail',
    `interop ${interop.score}% (${interop.passed}/${interop.total})`
  );
  line(docs.ok ? 'pass' : 'fail', `docs ${docs.completeness}%`);
  line(
    deployment.ok ? 'pass' : 'fail',
    `deployment ${deployment.ok ? 'registered' : 'incomplete'}`
  );
  line(
    'pass',
    `tasks ${overview.total} total, ${overview.open} open, avg ${overview.progressAverage}%`
  );
  return interop.ok && docs.ok && deployment.ok ? EXIT.OK : EXIT.FAIL;
}

function watchTargets(root) {
  return ['.agents', '.qoder', '.cursor']
    .map((entry) => path.join(root, entry))
    .filter((entry) => fs.existsSync(entry));
}

function cmdWatch(root, config, stateDir, flags) {
  let timer = null;
  let running = false;
  const debounceMs = Number(flags.interval || 500);
  const run = () => {
    if (running) return;
    running = true;
    try {
      const report = buildGateReport(root, config, 'working');
      if (report.ok) {
        line('pass', `watch: interop ${report.interop.score}%, docs ${report.docs.completeness}%`);
      } else {
        line('fail', `watch: interop ${report.interop.score}%, docs ${report.docs.completeness}%`);
        for (const violation of report.interop.violations) {
          emitAlert({ stateDir, config, alert: violation }).catch(() => {});
        }
        appendLedger({
          stateDir,
          config,
          action: 'WATCH_ALERT',
          subject: 'agent-content',
          result: 'failed',
          detail: { failures: report.interop.violations.length },
        });
      }
    } finally {
      running = false;
    }
  };

  run();
  if (flags.once) return EXIT.OK;

  const watchers = watchTargets(root).map((target) =>
    fs.watch(target, { recursive: true }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, debounceMs);
    })
  );
  console.log(`Watching ${watchers.length} agent-content root(s). Press Ctrl+C to stop.`);
  process.on('SIGINT', () => {
    for (const watcher of watchers) watcher.close();
    process.exit(EXIT.OK);
  });
  return null;
}

function help() {
  console.log(`Agentic Engineer — coordination, interoperability, and documentation governance

Usage:
  node tools/agentic-engineer/bin/agentic-engineer.cjs <command> [options]

Commands:
  init                         Initialize state and verify the deployed instance.
  validate                     Validate agent-content interoperability.
  docs [--write] [--staged]    Check documentation completeness and change sync.
  health [--write] [--json]    Monitor integration health and emit alerts.
  gate [--staged|--ci]         Read-only update gate (validate + docs + deployment).
  status                       Combined instance and coordination summary.
  watch [--once]               Watch agent content and re-run the gate on change.
  audit verify                 Verify the hash-chained audit ledger.
  coordinate <subcommand>      Task graph coordination (run "coordinate status").

Options:
  --root <path>                Repository root override.
  --state-dir <path>           Runtime state directory override.
  --json                       Machine-readable output.
  --quiet                      Suppress per-check output.
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const { flags, positional } = parseFlags(args.slice(1));
  const root = flags.root ? path.resolve(String(flags.root)) : ROOT;
  if (flags['state-dir']) {
    process.env.AGENTIC_ENGINEER_STATE_DIR = path.resolve(String(flags['state-dir']));
  }
  const { config, stateDir } = loadConfig(root);

  switch (command) {
    case 'init':
      return cmdInit(root, config, stateDir);
    case 'validate':
      return cmdValidate(root, config, flags);
    case 'docs':
      return cmdDocs(root, config, flags);
    case 'health':
      return cmdHealth(root, config, stateDir, flags);
    case 'gate':
      return cmdGate(root, config, flags);
    case 'status':
      return cmdStatus(root, config, stateDir);
    case 'watch':
      return cmdWatch(root, config, stateDir, flags);
    case 'audit':
      return cmdAudit(config, stateDir, flags);
    case 'coordinate':
      return cmdCoordinate(root, config, stateDir, flags, positional);
    case 'help':
    case '--help':
      help();
      return EXIT.OK;
    default:
      console.error(`Unknown command "${command}"`);
      help();
      return EXIT.USAGE;
  }
}

main()
  .then((code) => {
    if (typeof code === 'number') process.exitCode = code;
  })
  .catch((error) => {
    console.error(`[FAIL] ${error.message}`);
    if (process.env.AGENTIC_ENGINEER_DEBUG === '1') console.error(error.stack);
    process.exitCode = EXIT.FAIL;
  });
