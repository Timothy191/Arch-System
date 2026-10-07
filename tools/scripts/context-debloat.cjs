#!/usr/bin/env node

/**
 * @fileoverview Context Debloating Utility
 * Usage: node tools/scripts/context-debloat.cjs [--dry-run | --aggressive]
 *
 * Strategies:
 * 1. Identify and archive unused skills
 * 2. Prune oversized retrospectives
 * 3. Consolidate redundant rules
 * 4. Remove stale session logs
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_DIR = path.join(ROOT, '.agents', 'memory_base');
const AGENTS_DIR = path.join(ROOT, '.agents');
const SKILLS_DIR = path.join(AGENTS_DIR, 'skills');
const RULES_DIR = path.join(AGENTS_DIR, 'rules');

// Skills that are essential and should never be pruned
const ESSENTIAL_SKILLS = [
  'orca-cli',
  'orchestration',
  'agents-md',
  'ai-memory',
  'smart-memory-indexing',
  'agent-steering-anti-drift',
  'ce-compound',
  'ultragoal',
  'universal-agentic-execution',
  'real-world-checker',
  'self-reflection-loop',
];

// Skills that are likely unused or duplicates
const DEPRECATED_SKILL_PATTERNS = [
  'weather',
  'presentation',
  'azure-', // External skills, load on demand
  'firecrawl', // External skills, load on demand
  'upstash', // External skills, load on demand
  'composio', // External skills, load on demand
  'microsoft-foundry', // External skills, load on demand
  'entra-', // External skills, load on demand
];

function getDirSize(dirPath) {
  let totalSize = 0;
  if (!fs.existsSync(dirPath)) return totalSize;

  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    if (file.isDirectory()) {
      totalSize += getDirSize(fullPath);
    } else {
      totalSize += fs.statSync(fullPath).size;
    }
  }
  return totalSize;
}

function analyzeSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    return { total: 0, essential: 0, deprecated: 0, unused: 0, bySize: [] };
  }

  const skills = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => ({
      name: d.name,
      path: path.join(SKILLS_DIR, d.name),
      size: getDirSize(path.join(SKILLS_DIR, d.name)),
    }));

  skills.sort((a, b) => b.size - a.size);

  const analysis = {
    total: skills.length,
    essential: 0,
    deprecated: 0,
    unused: 0,
    bySize: skills,
  };

  for (const skill of skills) {
    if (ESSENTIAL_SKILLS.includes(skill.name)) {
      analysis.essential++;
    } else if (DEPRECATED_SKILL_PATTERNS.some((p) => skill.name.startsWith(p))) {
      analysis.deprecated++;
    } else {
      analysis.unused++;
    }
  }

  return analysis;
}

function analyzeRules() {
  if (!fs.existsSync(RULES_DIR)) {
    return { total: 0, oversized: 0, bySize: [] };
  }

  const rules = fs
    .readdirSync(RULES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({
      name: f,
      path: path.join(RULES_DIR, f),
      size: fs.statSync(path.join(RULES_DIR, f)).size,
    }));

  rules.sort((a, b) => b.size - a.size);

  return {
    total: rules.length,
    oversized: rules.filter((r) => r.size > 10000).length, // > 10KB
    bySize: rules,
  };
}

function archiveSkill(skillName, dryRun = false) {
  if (skillName === '.archived' || skillName.startsWith('.')) return;
  const skillPath = path.join(SKILLS_DIR, skillName);
  const archiveDir = path.join(SKILLS_DIR, '.archived');

  if (!fs.existsSync(archiveDir)) {
    if (!dryRun) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
  }

  const archivePath = path.join(archiveDir, skillName);

  if (dryRun) {
    console.log(`[DRY-RUN] Would archive: ${skillName}`);
    return;
  }

  if (fs.existsSync(archivePath)) {
    console.log(`⚠️ Archive already exists: ${skillName}, skipping`);
    return;
  }

  console.log(`🗑️ Archiving skill: ${skillName}`);
  fs.renameSync(skillPath, archivePath);
}

function pruneOversizedRules(maxSize = 10000, dryRun = false) {
  if (!fs.existsSync(RULES_DIR)) {
    console.log('No rules directory found');
    return;
  }

  const rules = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith('.md'));
  let pruned = 0;

  for (const rule of rules) {
    const rulePath = path.join(RULES_DIR, rule);
    const size = fs.statSync(rulePath).size;

    if (size > maxSize) {
      if (dryRun) {
        console.log(
          `[DRY-RUN] Would prune oversized rule: ${rule} (${(size / 1024).toFixed(1)} KB)`
        );
        pruned++;
      } else {
        console.log(`🗑️ Pruning oversized rule: ${rule} (${(size / 1024).toFixed(1)} KB)`);
        const content = fs.readFileSync(rulePath, 'utf-8');
        const lines = content.split('\n');

        // Simple strategy: keep first 500 lines
        if (lines.length > 500) {
          const prunedContent =
            lines.slice(0, 500).join('\n') + '\n\n... [Content truncated for size]';
          fs.writeFileSync(rulePath, prunedContent, 'utf-8');
          pruned++;
        }
      }
    }
  }

  if (dryRun && pruned > 0) {
    console.log(`[DRY-RUN] Would prune ${pruned} oversized rules`);
  } else if (pruned > 0) {
    console.log(`✅ Pruned ${pruned} oversized rules`);
  }
}

function removeStaleSessionLogs(dryRun = false) {
  const retroDir = path.join(MEMORY_DIR, 'retrospectives');
  if (!fs.existsSync(retroDir)) {
    return;
  }

  const files = fs
    .readdirSync(retroDir)
    .filter((f) => f.startsWith('session_') && f.endsWith('.json'));
  let removed = 0;

  for (const file of files) {
    const filePath = path.join(retroDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Remove session logs older than 7 days
    const timestamp = new Date(content.timestamp || content.createdAt || 0);
    const ageDays = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24);

    if (ageDays > 7) {
      if (dryRun) {
        console.log(
          `[DRY-RUN] Would remove stale session log: ${file} (${ageDays.toFixed(1)} days old)`
        );
        removed++;
      } else {
        console.log(`🗑️ Removing stale session log: ${file} (${ageDays.toFixed(1)} days old)`);
        const archiveDir = path.join(MEMORY_DIR, 'retrospectives-archived');
        if (!fs.existsSync(archiveDir)) {
          fs.mkdirSync(archiveDir, { recursive: true });
        }
        fs.renameSync(filePath, path.join(archiveDir, file));
        removed++;
      }
    }
  }

  if (dryRun && removed > 0) {
    console.log(`[DRY-RUN] Would remove ${removed} stale session logs`);
  } else if (removed > 0) {
    console.log(`✅ Removed ${removed} stale session logs`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const aggressive = args.includes('--aggressive');

  console.log('🧹 Context Debloating Utility\n');

  if (dryRun) {
    console.log('⚠️ DRY RUN MODE - No changes will be made\n');
  }

  // Analyze current state
  console.log('📊 Current State Analysis\n');

  const skillsAnalysis = analyzeSkills();
  console.log('Skills:');
  console.log(`  Total: ${skillsAnalysis.total}`);
  console.log(`  Essential: ${skillsAnalysis.essential}`);
  console.log(`  Deprecated (external): ${skillsAnalysis.deprecated}`);
  console.log(`  Potentially unused: ${skillsAnalysis.unused}`);
  console.log(`  Total size: ${(getDirSize(SKILLS_DIR) / 1024).toFixed(1)} KB`);

  if (skillsAnalysis.bySize.length > 0) {
    console.log('\n  Top 10 largest skills:');
    skillsAnalysis.bySize.slice(0, 10).forEach((skill, idx) => {
      const isEssential = ESSENTIAL_SKILLS.includes(skill.name) ? ' [ESSENTIAL]' : '';
      const isDeprecated = DEPRECATED_SKILL_PATTERNS.some((p) => skill.name.startsWith(p))
        ? ' [EXTERNAL]'
        : '';
      console.log(
        `    ${idx + 1}. ${skill.name}${isEssential}${isDeprecated} - ${(skill.size / 1024).toFixed(1)} KB`
      );
    });
  }

  const rulesAnalysis = analyzeRules();
  console.log('\nRules:');
  console.log(`  Total: ${rulesAnalysis.total}`);
  console.log(`  Oversized (>10KB): ${rulesAnalysis.oversized}`);
  console.log(`  Total size: ${(getDirSize(RULES_DIR) / 1024).toFixed(1)} KB`);

  if (rulesAnalysis.bySize.length > 0) {
    console.log('\n  Top 5 largest rules:');
    rulesAnalysis.bySize.slice(0, 5).forEach((rule, idx) => {
      console.log(`    ${idx + 1}. ${rule.name} - ${(rule.size / 1024).toFixed(1)} KB`);
    });
  }

  // Pruning strategies
  console.log('\n🧹 Pruning Strategies\n');

  if (aggressive) {
    console.log('⚡ AGGRESSIVE MODE - More aggressive pruning\n');

    // Archive deprecated skills
    for (const skill of skillsAnalysis.bySize) {
      if (DEPRECATED_SKILL_PATTERNS.some((p) => skill.name.startsWith(p))) {
        archiveSkill(skill.name, dryRun);
      }
    }

    // Archive largest unused skills
    const unusedSkills = skillsAnalysis.bySize.filter(
      (s) =>
        !ESSENTIAL_SKILLS.includes(s.name) &&
        !DEPRECATED_SKILL_PATTERNS.some((p) => s.name.startsWith(p))
    );
    const toArchive = unusedSkills.slice(0, Math.min(10, unusedSkills.length));
    for (const skill of toArchive) {
      archiveSkill(skill.name, dryRun);
    }
  } else {
    console.log('🐢 CONSERVATIVE MODE - Minimal pruning\n');

    // Only archive deprecated skills
    for (const skill of skillsAnalysis.bySize) {
      if (DEPRECATED_SKILL_PATTERNS.some((p) => skill.name.startsWith(p))) {
        archiveSkill(skill.name, dryRun);
      }
    }
  }

  // Prune oversized rules
  console.log('\n🧹 Pruning oversized rules...\n');
  pruneOversizedRules(10000, dryRun);

  // Remove stale session logs
  console.log('\n🧹 Removing stale session logs...\n');
  removeStaleSessionLogs(dryRun);

  // Re-index memory base & vector memory
  if (!dryRun) {
    console.log('\n🧹 Re-indexing memory base...\n');
    try {
      require('./smart-indexer.cjs');
    } catch (e) {
      console.warn('⚠️ Failed to re-index memory base:', e.message);
    }

    console.log('\n⚡ Synchronizing RuFlo Swarm SQLite vector database...\n');
    try {
      const { spawnSync } = require('node:child_process');
      spawnSync('node', [path.join(__dirname, 'sync-vector-memory.mjs')], { stdio: 'inherit' });
    } catch (e) {
      console.warn('⚠️ Failed to synchronize vector memory:', e.message);
    }
  }

  console.log('\n✅ Debloating complete\n');

  // Show new state
  if (!dryRun) {
    console.log('📊 New State:\n');
    console.log(`Skills size: ${(getDirSize(SKILLS_DIR) / 1024).toFixed(1)} KB`);
    console.log(`Rules size: ${(getDirSize(RULES_DIR) / 1024).toFixed(1)} KB`);
    console.log(`Memory base size: ${(getDirSize(MEMORY_DIR) / 1024).toFixed(1)} KB`);
  }
}

main();
