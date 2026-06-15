#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';

const TRACE_LOG = path.join(PROJ, 'ltm', 'store', 'traces.jsonl');
const AUDIT_LOG = path.join(PROJ, 'ltm', 'store', 'audit.jsonl');
const METRICS_LOG = path.join(PROJ, 'ltm', 'store', 'metrics.jsonl');
const SKILLS_REGISTRY = path.join(PROJ, '.kiro', 'skills', 'registry.json');
const SKILLS_DIR = path.join(PROJ, '.kiro', 'skills');

function readAllLines(file, maxLines = 5000) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).slice(-maxLines);
  } catch { return []; }
}

function loadSkills() {
  try {
    if (fs.existsSync(SKILLS_REGISTRY)) return JSON.parse(fs.readFileSync(SKILLS_REGISTRY, 'utf8'));
  } catch {}
  return { skills: [], generated_at: null };
}

function saveSkills(data) {
  try {
    if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
    fs.writeFileSync(SKILLS_REGISTRY, JSON.stringify(data, null, 2));
  } catch {}
}

function extractPatterns(traces) {
  const toolSequences = {};
  const errorPatterns = {};
  const successPatterns = {};

  for (let i = 0; i < traces.length - 1; i++) {
    try {
      const t = JSON.parse(traces[i]);
      const next = JSON.parse(traces[i + 1]);
      const pair = `${t.tool}→${next.tool}`;
      toolSequences[pair] = (toolSequences[pair] || 0) + 1;
      if (t.status === 'error' || t.status === 'failed') {
        errorPatterns[t.tool] = (errorPatterns[t.tool] || 0) + 1;
      } else {
        successPatterns[t.tool] = (successPatterns[t.tool] || 0) + 1;
      }
    } catch {}
  }
  return { toolSequences, errorPatterns, successPatterns };
}

function extractCommonGoals(auditLines) {
  const goals = {};
  for (const line of auditLines) {
    try {
      const entry = JSON.parse(line);
      const tool = entry.tool || entry.guard_type || '';
      const key = tool.replace(/\d+/g, 'N').slice(0, 60);
      goals[key] = (goals[key] || 0) + 1;
    } catch {}
  }
  return goals;
}

function generateSkills(patterns, goals) {
  const skills = [];
  const existing = loadSkills();

  const frequentSequences = Object.entries(patterns.toolSequences)
    .filter(([, count]) => count >= 3)
    .sort(([, a], [, b]) => b - a);

  if (frequentSequences.length > 0) {
    const topSeq = frequentSequences[0];
    skills.push({
      id: `skill_seq_${Date.now()}`,
      name: `Frequent Workflow: ${topSeq[0]}`,
      type: 'workflow_pattern',
      confidence: Math.min(topSeq[1] / 10, 1.0),
      pattern: topSeq[0],
      frequency: topSeq[1],
      generated_at: new Date().toISOString(),
      description: `Discovered tool sequence pattern: ${topSeq[0]} (${topSeq[1]} occurrences)`,
      suggestion: 'Consider creating a workflow template for this common sequence'
    });
  }

  const commonGoals = Object.entries(goals)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  for (const [goal, count] of commonGoals) {
    skills.push({
      id: `skill_goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Repeated Task: ${goal.slice(0, 50)}`,
      type: 'task_pattern',
      confidence: Math.min(count / 5, 1.0),
      pattern: goal,
      frequency: count,
      generated_at: new Date().toISOString(),
      description: `This task type appears ${count} times in session logs`,
      suggestion: 'Consider creating a specialized skill for this recurring task'
    });
  }

  existing.skills.push(...skills);
  if (existing.skills.length > 100) existing.skills.splice(0, existing.skills.length - 100);
  existing.generated_at = new Date().toISOString();
  saveSkills(existing);

  return skills;
}

function findRelevantSkills(taskDescription) {
  const registry = loadSkills();
  const words = taskDescription.toLowerCase().split(/\s+/);
  const relevant = [];

  for (const skill of registry.skills) {
    const skillWords = (skill.name + ' ' + skill.description).toLowerCase();
    let matchCount = 0;
    for (const w of words) {
      if (w.length > 3 && skillWords.includes(w)) matchCount++;
    }
    if (matchCount >= Math.max(2, words.length * 0.3)) {
      relevant.push({ ...skill, relevance: matchCount / words.length });
    }
  }

  relevant.sort((a, b) => b.relevance - a.relevance);
  return relevant.slice(0, 5);
}

async function main() {
  const cmd = process.argv[2] || 'analyze';

  switch (cmd) {
    case 'analyze': {
      const traces = readAllLines(TRACE_LOG);
      const auditLines = readAllLines(AUDIT_LOG);
      const patterns = extractPatterns(traces);
      const goals = extractCommonGoals(auditLines);
      const skills = generateSkills(patterns, goals);

      console.log(JSON.stringify({
        analyzed: { traces: traces.length, audit_entries: auditLines.length },
        patterns: {
          frequent_sequences: Object.entries(patterns.toolSequences)
            .filter(([, c]) => c >= 3).sort(([, a], [, b]) => b - a).slice(0, 10),
          error_rate: Object.keys(patterns.errorPatterns).length > 0
            ? Object.values(patterns.errorPatterns).reduce((a, b) => a + b, 0) / Math.max(traces.length, 1)
            : 0
        },
        skills_generated: skills.length,
        total_skills: loadSkills().skills.length
      }, null, 2));
      break;
    }

    case 'recall': {
      const task = process.argv.slice(3).join(' ') || '';
      if (!task) {
        console.log(JSON.stringify({ skills: [], message: 'No task provided' }));
        break;
      }
      const relevant = findRelevantSkills(task);
      console.log(JSON.stringify({ task, relevant_skills: relevant.length, skills: relevant }, null, 2));
      break;
    }

    case 'status': {
      const registry = loadSkills();
      const byType = {};
      for (const s of registry.skills) {
        const type = s.type || 'unknown';
        if (!byType[type]) byType[type] = [];
        byType[type].push(s.name);
      }
      console.log(JSON.stringify({
        total_skills: registry.skills.length,
        generated_at: registry.generated_at,
        by_type: Object.fromEntries(
          Object.entries(byType).map(([t, names]) => [t, { count: names.length, examples: names.slice(0, 3) }])
        )
      }, null, 2));
      break;
    }

    default:
      console.log('Commands: analyze | recall <task> | status');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
}

module.exports = { extractPatterns, generateSkills, findRelevantSkills };
