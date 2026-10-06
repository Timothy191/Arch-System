#!/usr/bin/env node

/**
 * @fileoverview Token Usage Tracker & Context Budget Manager
 * Usage: node tools/scripts/token-tracker.cjs [--analyze | --prune | --budget-check]
 *
 * Features:
 * - Tracks token usage across agent sessions
 * - Identifies context bloat sources
 * - Prunes unnecessary retrospectives and logs
 * - Enforces context budget limits
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_DIR = path.join(ROOT, '.agents', 'memory_base');
const TOKEN_TRACKER_FILE = path.join(MEMORY_DIR, 'token-usage.json');
const CONTEXT_BUDGET_FILE = path.join(MEMORY_DIR, 'context-budget.json');
const AGENTS_DIR = path.join(ROOT, '.agents');

// Default budget limits (in characters, approximating tokens)
const DEFAULT_BUDGET = {
  maxRetrospectives: 50,
  maxRetrospectiveSize: 5000,
  maxRulesSize: 100000,
  maxSkillsSize: 350000,
  maxSessionContext: 500000,
  maxRootInstructionsSize: 20000,
  maxDirectMcpServers: 10,
};

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function loadTokenTracker() {
  ensureMemoryDir();
  if (fs.existsSync(TOKEN_TRACKER_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TOKEN_TRACKER_FILE, 'utf-8'));
    } catch (e) {
      console.warn('⚠️ Malformed token-tracker.json, starting fresh');
    }
  }
  return {
    lastUpdated: new Date().toISOString(),
    sessions: [],
    totalTokens: 0,
    totalSessions: 0,
  };
}

function saveTokenTracker(data) {
  fs.writeFileSync(TOKEN_TRACKER_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function loadContextBudget() {
  ensureMemoryDir();
  if (fs.existsSync(CONTEXT_BUDGET_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONTEXT_BUDGET_FILE, 'utf-8'));
    } catch (e) {
      console.warn('⚠️ Malformed context-budget.json, using defaults');
    }
  }
  return DEFAULT_BUDGET;
}

function saveContextBudget(data) {
  fs.writeFileSync(CONTEXT_BUDGET_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getDirSize(dirPath, excludeDirs = []) {
  let totalSize = 0;
  if (!fs.existsSync(dirPath)) return totalSize;

  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    if (file.isDirectory()) {
      if (excludeDirs.includes(file.name)) {
        continue;
      }
      totalSize += getDirSize(fullPath, excludeDirs);
    } else {
      totalSize += fs.statSync(fullPath).size;
    }
  }
  return totalSize;
}

function analyzeRetrospectives() {
  const retroDir = path.join(MEMORY_DIR, 'retrospectives');
  if (!fs.existsSync(retroDir)) {
    return { count: 0, totalSize: 0, oversized: [] };
  }

  const files = fs.readdirSync(retroDir).filter((f) => f.endsWith('.json'));
  const analysis = {
    count: files.length,
    totalSize: 0,
    oversized: [],
    byCategory: {},
  };

  for (const file of files) {
    const filePath = path.join(retroDir, file);
    const size = fs.statSync(filePath).size;
    analysis.totalSize += size;

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const category = content.category || 'UNKNOWN';
    analysis.byCategory[category] = (analysis.byCategory[category] || 0) + 1;

    if (size > DEFAULT_BUDGET.maxRetrospectiveSize) {
      analysis.oversized.push({ file, size });
    }
  }

  return analysis;
}

function analyzeRules() {
  const rulesDir = path.join(AGENTS_DIR, 'rules');
  return {
    count: fs.existsSync(rulesDir)
      ? fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md')).length
      : 0,
    totalSize: getDirSize(rulesDir),
  };
}

function analyzeSkills() {
  const skillsDir = path.join(AGENTS_DIR, 'skills');
  return {
    count: fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).length : 0,
    totalSize: getDirSize(skillsDir, ['.archived']),
  };
}

function analyzeRootInstructions() {
  const rootFiles = ['CLAUDE.md', 'AGENTS.md', '.claude.local.md', 'GEMINI.md'];
  const breakdown = [];
  let totalSize = 0;

  for (const file of rootFiles) {
    const filePath = path.join(ROOT, file);
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      totalSize += size;
      breakdown.push({ file, size });
    }
  }

  return { totalSize, breakdown };
}

function analyzeMcpConfig() {
  const settingsLocalPath = path.join(ROOT, '.claude', 'settings.local.json');
  if (!fs.existsSync(settingsLocalPath)) {
    return { count: 0, enableAllProjectMcpServers: false, servers: [] };
  }

  try {
    const config = JSON.parse(fs.readFileSync(settingsLocalPath, 'utf-8'));
    const servers = config.enabledMcpjsonServers || [];
    return {
      count: servers.length,
      enableAllProjectMcpServers: Boolean(config.enableAllProjectMcpServers),
      servers,
    };
  } catch {
    return { count: 0, enableAllProjectMcpServers: false, servers: [] };
  }
}

function pruneOversizedRetrospectives() {
  const retroDir = path.join(MEMORY_DIR, 'retrospectives');
  if (!fs.existsSync(retroDir)) {
    console.log('No retrospectives directory found');
    return;
  }

  const budget = loadContextBudget();
  const files = fs.readdirSync(retroDir).filter((f) => f.endsWith('.json'));
  let pruned = 0;

  for (const file of files) {
    const filePath = path.join(retroDir, file);
    const size = fs.statSync(filePath).size;

    if (size > budget.maxRetrospectiveSize) {
      console.log(`🗑️ Pruning oversized retrospective: ${file} (${(size / 1024).toFixed(1)} KB)`);
      const backupDir = path.join(MEMORY_DIR, 'retrospectives-archived');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.renameSync(filePath, path.join(backupDir, file));
      pruned++;
    }
  }

  console.log(`✅ Pruned ${pruned} oversized retrospectives`);
}

function pruneOldRetrospectives(maxCount = 50) {
  const retroDir = path.join(MEMORY_DIR, 'retrospectives');
  if (!fs.existsSync(retroDir)) {
    console.log('No retrospectives directory found');
    return;
  }

  const files = fs.readdirSync(retroDir).filter((f) => f.endsWith('.json'));
  if (files.length <= maxCount) {
    console.log(`Retrospectives count (${files.length}) within budget (${maxCount})`);
    return;
  }

  const entries = files.map((file) => {
    const filePath = path.join(retroDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return {
      file,
      timestamp: content.timestamp || '1970-01-01T00:00:00Z',
    };
  });

  entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const toRemove = entries.slice(0, entries.length - maxCount);

  const backupDir = path.join(MEMORY_DIR, 'retrospectives-archived');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  for (const entry of toRemove) {
    const filePath = path.join(retroDir, entry.file);
    console.log(`🗑️ Archiving old retrospective: ${entry.file} (${entry.timestamp})`);
    fs.renameSync(filePath, path.join(backupDir, entry.file));
  }

  console.log(`✅ Archived ${toRemove.length} old retrospectives`);
}

function checkBudget() {
  const budget = loadContextBudget();
  const retrospectives = analyzeRetrospectives();
  const rules = analyzeRules();
  const skills = analyzeSkills();

  console.log('\n📊 Context Budget Analysis\n');
  console.log('Retrospectives:');
  console.log(`  Count: ${retrospectives.count} / ${budget.maxRetrospectives}`);
  console.log(`  Size: ${(retrospectives.totalSize / 1024).toFixed(1)} KB`);
  if (retrospectives.oversized.length > 0) {
    console.log(`  ⚠️ Oversized: ${retrospectives.oversized.length}`);
  }

  console.log('\nRules:');
  console.log(`  Count: ${rules.count}`);
  console.log(
    `  Size: ${(rules.totalSize / 1024).toFixed(1)} KB / ${(budget.maxRulesSize / 1024).toFixed(1)} KB`
  );

  console.log('\nSkills:');
  console.log(`  Count: ${skills.count}`);
  console.log(
    `  Size: ${(skills.totalSize / 1024).toFixed(1)} KB / ${(budget.maxSkillsSize / 1024).toFixed(1)} KB`
  );

  const rootInstructions = analyzeRootInstructions();
  const maxRootSize = budget.maxRootInstructionsSize || 15000;
  console.log('\nRoot Directives:');
  console.log(
    `  Size: ${(rootInstructions.totalSize / 1024).toFixed(1)} KB / ${(maxRootSize / 1024).toFixed(1)} KB`
  );
  rootInstructions.breakdown.forEach((item) => {
    console.log(`    - ${item.file}: ${(item.size / 1024).toFixed(1)} KB`);
  });

  const mcpConfig = analyzeMcpConfig();
  const maxDirectMcp = budget.maxDirectMcpServers || 10;
  console.log('\nDirect MCP Tooling:');
  console.log(`  Enabled Servers: ${mcpConfig.count} / ${maxDirectMcp}`);
  console.log(`  enableAllProjectMcpServers: ${mcpConfig.enableAllProjectMcpServers}`);

  const issues = [];
  if (retrospectives.count > budget.maxRetrospectives) {
    issues.push(
      `Retrospectives exceed budget (${retrospectives.count} > ${budget.maxRetrospectives})`
    );
  }
  if (rules.totalSize > budget.maxRulesSize) {
    issues.push(
      `Rules size exceeds budget (${(rules.totalSize / 1024).toFixed(1)} KB > ${(budget.maxRulesSize / 1024).toFixed(1)} KB)`
    );
  }
  if (skills.totalSize > budget.maxSkillsSize) {
    issues.push(
      `Skills size exceeds budget (${(skills.totalSize / 1024).toFixed(1)} KB > ${(budget.maxSkillsSize / 1024).toFixed(1)} KB)`
    );
  }
  if (rootInstructions.totalSize > maxRootSize) {
    issues.push(
      `Root instructions size exceeds budget (${(rootInstructions.totalSize / 1024).toFixed(1)} KB > ${(maxRootSize / 1024).toFixed(1)} KB)`
    );
  }
  if (mcpConfig.count > maxDirectMcp) {
    issues.push(
      `Direct MCP servers exceed budget (${mcpConfig.count} > ${maxDirectMcp}). Route external tools through slim-tooling-mcp.`
    );
  }
  if (mcpConfig.enableAllProjectMcpServers) {
    issues.push(
      `enableAllProjectMcpServers must be false to prevent raw tool schema explosion. Use slim-tooling-mcp proxy.`
    );
  }

  if (issues.length > 0) {
    console.log('\n❌ Budget violations:');
    issues.forEach((issue) => console.log(`  - ${issue}`));
    return false;
  }

  console.log('\n✅ All budgets within limits');
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'analyze';

  switch (command) {
    case '--analyze':
    case 'analyze':
      checkBudget();
      break;

    case '--prune':
    case 'prune':
      console.log('🧹 Pruning oversized retrospectives...');
      pruneOversizedRetrospectives();
      console.log('\n🧹 Pruning old retrospectives...');
      pruneOldRetrospectives();
      console.log('\n🧹 Re-indexing memory base...');
      require('./smart-indexer.cjs');
      break;

    case '--budget-check':
    case 'budget-check':
      const withinBudget = checkBudget();
      process.exit(withinBudget ? 0 : 1);
      break;

    case '--set-budget':
    case 'set-budget':
      const key = args[1];
      const value = parseInt(args[2], 10);
      if (!key || isNaN(value)) {
        console.error('Usage: token-tracker.cjs --set-budget <key> <value>');
        console.error(
          'Keys: maxRetrospectives, maxRetrospectiveSize, maxRulesSize, maxSkillsSize, maxSessionContext'
        );
        process.exit(1);
      }
      const budget = loadContextBudget();
      budget[key] = value;
      saveContextBudget(budget);
      console.log(`✅ Set ${key} = ${value}`);
      break;

    default:
      console.log('Token Usage Tracker & Context Budget Manager');
      console.log('\nCommands:');
      console.log('  analyze      - Analyze current context usage (default)');
      console.log('  prune        - Prune oversized and old retrospectives');
      console.log('  budget-check - Check if within budget limits (exit code 0/1)');
      console.log('  set-budget   - Set a budget limit (e.g., set-budget maxRetrospectives 100)');
  }
}

main();
