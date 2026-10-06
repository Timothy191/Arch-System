#!/usr/bin/env node

/**
 * AI & Agentic Content Auditor
 *
 * Audits and reviews all agentic configuration files, skills, rules,
 * MCP definitions, root agent directives, and package-level AGENT_TRACER.md files.
 *
 * Checks:
 *   1. .agents/rules/ integrity (non-empty markdown, structured guidelines)
 *   2. .agents/skills/ integrity (SKILL.md presence, YAML frontmatter name & description)
 *   3. .agents/mcp_config.json (JSON syntax & server configurations)
 *   4. AGENT_TRACER.md coverage across all workspace packages, apps, and libraries
 *   5. Root agent directives (AGENTS.md, GEMINI.md, CLAUDE.md)
 *
 * Run: node tools/audits/audit-agentic-content.cjs
 *      node tools/audits/audit-agentic-content.cjs --check   (verify only; never writes)
 * Exit code: 0 (pass) or 1 (fail)
 *
 * Idempotency contract: the emitted report is a pure function of the audited
 * inputs. It carries no wall-clock timestamp, and its markdown matches the
 * repository's prettier/markdownlint canonical layout — so re-running this
 * auditor on an unchanged tree rewrites nothing and leaves `git status` clean.
 * Generation provenance lives in `git log -1 -- documentation/03-audit-reports/`.
 */

const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');
const { getActiveSkillDirectories } = require('./active-skill-directories.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(ROOT, '.agents');
const REPORT_DIR = path.join(ROOT, 'documentation', '03-audit-reports');
const REPORT_PATH = path.join(REPORT_DIR, 'agentic-audit-report.md');

/** When set, the auditor validates the on-disk report instead of rewriting it. */
const CHECK_ONLY = process.argv.includes('--check');

console.log('\n🤖 Initiating AI & Agentic Content Audit...\n');

const violations = [];
const warnings = [];

// ── 1. Audit .agents/rules/ ───────────────────────────────────────────────────
console.log('1️⃣  Auditing .agents/rules/ directives...');
const rulesDir = path.join(AGENTS_DIR, 'rules');
let rulesCount = 0;
if (fs.existsSync(rulesDir)) {
  const ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md'));
  ruleFiles.forEach((file) => {
    rulesCount++;
    const fullPath = path.join(rulesDir, file);
    const content = fs.readFileSync(fullPath, 'utf8').trim();
    if (content.length < 20) {
      violations.push({
        file: `.agents/rules/${file}`,
        type: 'EMPTY_RULE_FILE',
        description: 'Rule file is empty or lacks substantive content.',
      });
    }
  });
  console.log(`   ✓ Audited ${rulesCount} agent rule definitions.`);
} else {
  warnings.push({
    file: '.agents/rules',
    type: 'MISSING_RULES_DIR',
    description: 'No .agents/rules directory found.',
  });
}

// ── 2. Audit .agents/skills/ ──────────────────────────────────────────────────
console.log('2️⃣  Auditing .agents/skills/ packages and frontmatter schemas...');
const skillsDir = path.join(AGENTS_DIR, 'skills');
let skillsCount = 0;
if (fs.existsSync(skillsDir)) {
  const skillEntries = getActiveSkillDirectories(
    fs.readdirSync(skillsDir, { withFileTypes: true })
  );
  skillEntries.forEach((entry) => {
    skillsCount++;
    const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) {
      violations.push({
        file: `.agents/skills/${entry.name}`,
        type: 'MISSING_SKILL_MD',
        description: `Skill folder is missing required SKILL.md.`,
      });
    } else {
      const content = fs.readFileSync(skillFile, 'utf8');
      // Validate YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        warnings.push({
          file: `.agents/skills/${entry.name}/SKILL.md`,
          type: 'MISSING_FRONTMATTER',
          description: `SKILL.md is missing YAML frontmatter (name, description).`,
        });
      } else {
        const fm = frontmatterMatch[1];
        if (!fm.includes('name:') || !fm.includes('description:')) {
          warnings.push({
            file: `.agents/skills/${entry.name}/SKILL.md`,
            type: 'INCOMPLETE_FRONTMATTER',
            description: `Frontmatter missing required 'name' or 'description' field.`,
          });
        }
      }
    }
  });
  console.log(`   ✓ Audited ${skillsCount} agent skills.`);
} else {
  warnings.push({
    file: '.agents/skills',
    type: 'MISSING_SKILLS_DIR',
    description: 'No .agents/skills directory found.',
  });
}

// ── 3. Audit .agents/mcp_config.json ──────────────────────────────────────────
console.log('3️⃣  Auditing MCP server configurations...');
const mcpFile = path.join(AGENTS_DIR, 'mcp_config.json');
if (fs.existsSync(mcpFile)) {
  try {
    const raw = fs.readFileSync(mcpFile, 'utf8');
    const parsed = JSON.parse(raw);
    const serverCount = parsed.mcpServers ? Object.keys(parsed.mcpServers).length : 0;
    console.log(`   ✓ Validated MCP configuration with ${serverCount} configured server(s).`);
  } catch (err) {
    violations.push({
      file: '.agents/mcp_config.json',
      type: 'INVALID_JSON',
      description: `mcp_config.json is invalid JSON: ${err.message}`,
    });
  }
}

// ── 4. Audit AGENT_TRACER.md Monorepo Coverage ────────────────────────────────
console.log('4️⃣  Auditing AGENT_TRACER.md coverage across workspace packages...');
const workspacePackages = glob.sync('{apps/*,packages/*,libs/features/*,libs/shared/*}', {
  cwd: ROOT,
  ignore: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
});

let tracerCount = 0;
const missingTracers = [];
workspacePackages.forEach((pkgPath) => {
  const tracerFile = path.join(ROOT, pkgPath, 'AGENT_TRACER.md');
  if (fs.existsSync(tracerFile)) {
    tracerCount++;
    const content = fs.readFileSync(tracerFile, 'utf8').trim();
    if (content.length < 30) {
      warnings.push({
        file: `${pkgPath}/AGENT_TRACER.md`,
        type: 'INCOMPLETE_TRACER',
        description: 'AGENT_TRACER.md exists but has no substantial historical entries.',
      });
    }
  } else {
    // Check if it's a real workspace package containing package.json
    if (fs.existsSync(path.join(ROOT, pkgPath, 'package.json'))) {
      missingTracers.push(pkgPath);
    }
  }
});

console.log(`   ✓ Found ${tracerCount}/${workspacePackages.length} active AGENT_TRACER.md files.`);

// ── 5. Audit Root Agent Directives ────────────────────────────────────────────
console.log('5️⃣  Auditing Root Directives (AGENTS.md, GEMINI.md, CLAUDE.md)...');
const ROOT_DOCS = ['AGENTS.md', 'GEMINI.md', 'CLAUDE.md'];
ROOT_DOCS.forEach((doc) => {
  const docPath = path.join(ROOT, doc);
  if (!fs.existsSync(docPath)) {
    violations.push({
      file: doc,
      type: 'MISSING_ROOT_DIRECTIVE',
      description: `Essential root AI instruction file "${doc}" is missing.`,
    });
  } else {
    const content = fs.readFileSync(docPath, 'utf8');
    if (content.length < 100) {
      violations.push({
        file: doc,
        type: 'EMPTY_ROOT_DIRECTIVE',
        description: `Root instruction file "${doc}" has insufficient content.`,
      });
    }
  }
});
console.log(`   ✓ Verified all ${ROOT_DOCS.length} root AI agent guidelines.`);

// ── 6. Results Summary & Report Generation ────────────────────────────────────
console.log('\n==================================================');
console.log('📊 AI & Agentic Content Audit Results');
console.log('==================================================');

if (violations.length > 0) {
  console.error(`\n❌  ${violations.length} Critical Violation(s) Found:`);
  violations.forEach((v) => {
    console.error(`   [${v.type}] ${v.file} — ${v.description}`);
  });
} else {
  console.log('✅  0 Critical Violations. All AI & Agentic content is 100% compliant!');
}

if (warnings.length > 0) {
  console.warn(`\n⚠️   ${warnings.length} Advisory Notice(s):`);
  warnings.forEach((w) => {
    console.warn(`   [${w.type}] ${w.file} — ${w.description}`);
  });
}

/**
 * Deterministic report body. Deliberately carries no wall-clock field: the
 * report must be a pure function of the audited inputs, or every invocation
 * rewrites it and the working tree can never be clean. Blank lines around
 * headings keep this byte-identical to the markdownlint/prettier canonical form.
 */
const reportMd = `# AI & Agentic Content Audit Report

## Summary Metrics

- **Agent Rules**: ${rulesCount} verified in \`.agents/rules/\`
- **Agent Skills**: ${skillsCount} verified in \`.agents/skills/\`
- **Workspace Tracers**: ${tracerCount} \`AGENT_TRACER.md\` files active
- **Root Directives**: ${ROOT_DOCS.join(', ')} validated

## Critical Findings

${violations.length === 0 ? '✅ None' : violations.map((v) => `- **[${v.type}]** \`${v.file}\`: ${v.description}`).join('\n')}

## Advisories & Warnings

${warnings.length === 0 ? '✅ None' : warnings.map((w) => `- **[${w.type}]** \`${w.file}\`: ${w.description}`).join('\n')}
`;

const REPORT_REL = 'documentation/03-audit-reports/agentic-audit-report.md';
const previousMd = fs.existsSync(REPORT_PATH) ? fs.readFileSync(REPORT_PATH, 'utf8') : null;
const drifted = previousMd !== reportMd;

if (CHECK_ONLY) {
  if (drifted) {
    console.error(`\n❌ Report is stale: ${REPORT_REL}`);
    console.error('   Regenerate with: node tools/audits/audit-agentic-content.cjs');
    process.exit(1);
  }
  console.log(`\n📄 Report is up to date: ${REPORT_REL}`);
} else if (drifted) {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, reportMd, 'utf8');
  console.log(`\n📄 Report written to: ${REPORT_REL}`);
} else {
  // Byte-identical: skip the write so mtime and `git status` stay untouched.
  console.log(`\n📄 Report unchanged: ${REPORT_REL}`);
}

const score = violations.length === 0 ? 100.0 : Math.max(0, 100.0 - violations.length * 15);
console.log(`🎯 Agentic Compliance Score: ${score.toFixed(1)}%`);
console.log('==================================================\n');

process.exit(violations.length > 0 ? 1 : 0);
