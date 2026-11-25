'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_COMPATIBILITY_LENGTH = 500;
const RECOMMENDED_MAX_LINES = 500;
const ALLOWED_FRONTMATTER_KEYS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
  // Qoder/Claude convention: user-only invocation for side-effect workflows.
  'disable-model-invocation',
]);

/**
 * Parse top-level YAML frontmatter keys and scalar values from SKILL.md.
 * Handles single-line strings, quoted strings, and indented block/map keys.
 */
function parseFrontmatter(rawFrontmatter) {
  const fields = {};
  const lines = rawFrontmatter.split(/\r?\n/);
  let currentKey = null;
  let blockLines = [];

  const flushBlock = () => {
    if (currentKey && blockLines.length > 0 && typeof fields[currentKey] !== 'string') {
      fields[currentKey] = blockLines.join(' ').trim();
    }
    blockLines = [];
  };

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (keyMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      flushBlock();
      const key = keyMatch[1];
      let val = keyMatch[2].trim();
      currentKey = key;
      if (val === '|' || val === '>' || val === '|-' || val === '>-') {
        fields[key] = '';
      } else if (val === '') {
        fields[key] = {};
      } else {
        if (
          (val.startsWith("'") && val.endsWith("'") && val.length >= 2) ||
          (val.startsWith('"') && val.endsWith('"') && val.length >= 2)
        ) {
          val = val.slice(1, -1);
        }
        fields[key] = val;
      }
      continue;
    }
    if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      blockLines.push(line.trim());
    }
  }
  flushBlock();
  return fields;
}

/**
 * Find broken relative markdown links inside SKILL.md body.
 */
function findBrokenRelativeLinks(skillDir, content) {
  const broken = [];
  const stripped = content.replace(/```[\s\S]*?```/g, '');
  const linkRe = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const match of stripped.matchAll(linkRe)) {
    const rawTarget = match[1];
    if (
      !rawTarget ||
      rawTarget.includes('://') ||
      rawTarget.startsWith('mailto:') ||
      rawTarget.startsWith('#')
    ) {
      continue;
    }
    const targetPath = rawTarget.split('#')[0].split('?')[0];
    if (!targetPath) continue;
    const resolved = path.resolve(skillDir, targetPath);
    if (!fs.existsSync(resolved)) {
      broken.push(rawTarget);
    }
  }
  return broken;
}

/**
 * Validate a single Agent Skill directory against https://agentskills.io/specification.md.
 * Returns { errors: Array<{type, description}>, warnings: Array<{type, description}> }.
 */
function validateSkillDirectory(skillDir) {
  const errors = [];
  const warnings = [];
  const dirName = path.basename(skillDir);
  const skillFile = path.join(skillDir, 'SKILL.md');

  if (!fs.existsSync(skillFile)) {
    errors.push({
      type: 'MISSING_SKILL_MD',
      description: 'Skill folder is missing required SKILL.md.',
    });
    return { errors, warnings };
  }

  const content = fs.readFileSync(skillFile, 'utf8');
  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > RECOMMENDED_MAX_LINES) {
    warnings.push({
      type: 'SKILL_MD_TOO_LONG',
      description: `SKILL.md is ${lineCount} lines (recommended <= ${RECOMMENDED_MAX_LINES}; move details to references/).`,
    });
  }

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    errors.push({
      type: 'MISSING_FRONTMATTER',
      description: 'SKILL.md is missing YAML frontmatter (name, description).',
    });
    return { errors, warnings };
  }

  const fields = parseFrontmatter(fmMatch[1]);
  const skillName = typeof fields.name === 'string' ? fields.name.trim() : '';
  const description = typeof fields.description === 'string' ? fields.description.trim() : '';

  if (!skillName) {
    errors.push({
      type: 'MISSING_SKILL_NAME',
      description: 'Frontmatter missing required "name" field.',
    });
  } else {
    if (skillName.length > MAX_NAME_LENGTH || !SKILL_NAME_RE.test(skillName)) {
      errors.push({
        type: 'INVALID_SKILL_NAME',
        description: `Skill name "${skillName}" must be 1-${MAX_NAME_LENGTH} lowercase alphanumeric/hyphen characters.`,
      });
    }
    if (skillName !== dirName) {
      errors.push({
        type: 'SKILL_NAME_DIR_MISMATCH',
        description: `Frontmatter name "${skillName}" must match directory name "${dirName}".`,
      });
    }
  }

  if (!description) {
    errors.push({
      type: 'MISSING_SKILL_DESCRIPTION',
      description: 'Frontmatter missing required "description" field.',
    });
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({
      type: 'SKILL_DESCRIPTION_TOO_LONG',
      description: `Description length ${description.length} exceeds ${MAX_DESCRIPTION_LENGTH} characters.`,
    });
  }

  if (
    typeof fields.compatibility === 'string' &&
    fields.compatibility.length > MAX_COMPATIBILITY_LENGTH
  ) {
    errors.push({
      type: 'SKILL_COMPATIBILITY_TOO_LONG',
      description: `Compatibility length exceeds ${MAX_COMPATIBILITY_LENGTH} characters.`,
    });
  }

  for (const key of Object.keys(fields)) {
    if (!ALLOWED_FRONTMATTER_KEYS.has(key)) {
      warnings.push({
        type: 'NON_SPEC_FRONTMATTER_KEY',
        description: `Frontmatter key "${key}" is not part of the Agent Skills spec (move custom keys under metadata:).`,
      });
    }
  }

  const brokenLinks = findBrokenRelativeLinks(skillDir, content);
  for (const broken of brokenLinks) {
    errors.push({
      type: 'BROKEN_SKILL_LINK',
      description: `Relative link "${broken}" in SKILL.md does not exist on disk.`,
    });
  }

  return { errors, warnings };
}

module.exports = {
  ALLOWED_FRONTMATTER_KEYS,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  RECOMMENDED_MAX_LINES,
  parseFrontmatter,
  validateSkillDirectory,
};
