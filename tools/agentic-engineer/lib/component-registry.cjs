'use strict';

/**
 * Discovers every agent-content component in the checkout and normalizes it
 * into a single catalog used by validation, documentation, and reporting.
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  firstHeading,
  isExecutable,
  listDirectories,
  listFiles,
  parseFrontmatter,
  readJson,
  readJsonl,
  readText,
  relative,
} = require('./util.cjs');

function discoverAgents(root) {
  const base = path.join(root, '.agents', 'agents');
  return listDirectories(base).map((name) => {
    const relativePath = relative(root, path.join(base, name, 'agent.md'));
    const content = readText(path.join(base, name, 'agent.md'));
    const { present, fields } = parseFrontmatter(content);
    return {
      name,
      path: relativePath,
      exists: content.length > 0,
      frontmatter: present,
      fields,
      description: typeof fields.description === 'string' ? fields.description : '',
    };
  });
}

function discoverRegistry(root) {
  const base = path.join(root, '.agents', 'a2a', 'registry');
  return listFiles(base, '.json').map((file) => {
    const relativePath = relative(root, path.join(base, file));
    const parsed = readJson(path.join(base, file), null);
    const data = parsed.value && typeof parsed.value === 'object' ? parsed.value : {};
    return {
      name: typeof data.name === 'string' ? data.name : file.replace(/\.json$/, ''),
      path: relativePath,
      valid: parsed.ok,
      error: parsed.error,
      data,
      description: typeof data.description === 'string' ? data.description : '',
    };
  });
}

function discoverSkills(root, skillRoot) {
  const base = path.join(root, skillRoot);
  return listDirectories(base).map((name) => {
    const content = readText(path.join(base, name, 'SKILL.md'));
    const { present, fields } = parseFrontmatter(content);
    return {
      name: typeof fields.name === 'string' ? fields.name : name,
      directory: name,
      root: skillRoot,
      path: relative(root, path.join(base, name, 'SKILL.md')),
      exists: content.length > 0,
      frontmatter: present,
      description: typeof fields.description === 'string' ? fields.description : '',
    };
  });
}

function discoverRules(root) {
  const rules = [];
  const agentRules = path.join(root, '.agents', 'rules');
  for (const file of listFiles(agentRules, '.md')) {
    const content = readText(path.join(agentRules, file));
    const { present, fields } = parseFrontmatter(content);
    rules.push({
      name: typeof fields.name === 'string' ? fields.name : file.replace(/\.md$/, ''),
      root: '.agents/rules',
      path: relative(root, path.join(agentRules, file)),
      frontmatter: present,
      description:
        (typeof fields.description === 'string' && fields.description) || firstHeading(content),
      nonEmpty: content.trim().length > 0,
    });
  }
  const cursorRules = path.join(root, '.cursor', 'rules');
  for (const file of listFiles(cursorRules, '.mdc')) {
    const content = readText(path.join(cursorRules, file));
    const { present, fields } = parseFrontmatter(content);
    rules.push({
      name: file.replace(/\.mdc$/, ''),
      root: '.cursor/rules',
      path: relative(root, path.join(cursorRules, file)),
      frontmatter: present,
      description:
        (typeof fields.description === 'string' && fields.description) || firstHeading(content),
      nonEmpty: content.trim().length > 0,
    });
  }
  return rules;
}

function discoverSchemas(root) {
  const base = path.join(root, '.agents', 'a2a', 'schemas');
  return listFiles(base, '.json').map((file) => {
    const parsed = readJson(path.join(base, file), null);
    const data = parsed.value && typeof parsed.value === 'object' ? parsed.value : {};
    return {
      name: file.replace(/\.json$/, ''),
      path: relative(root, path.join(base, file)),
      valid: parsed.ok,
      error: parsed.error,
      data,
      description: typeof data.title === 'string' ? data.title : '',
    };
  });
}

function collectHookCommands(hooksConfig) {
  const references = [];
  const events = hooksConfig?.hooks || {};
  for (const [event, handlers] of Object.entries(events)) {
    for (const handler of Array.isArray(handlers) ? handlers : []) {
      const command = typeof handler.command === 'string' ? handler.command : '';
      for (const match of command.matchAll(/(\.agents\/hooks\/[A-Za-z0-9_.-]+)/g)) {
        references.push({ event, script: match[1] });
      }
    }
  }
  return references;
}

function discoverHooks(root) {
  const hooksConfigParsed = readJson(path.join(root, '.agents', 'hooks.json'), null);
  const hooksConfig = hooksConfigParsed.value || { hooks: {} };
  const references = collectHookCommands(hooksConfig);
  const scripts = new Map();
  for (const reference of references) {
    const entry = scripts.get(reference.script) || {
      script: reference.script,
      events: [],
      exists: fs.existsSync(path.join(root, reference.script)),
      executable: isExecutable(path.join(root, reference.script)),
    };
    entry.events.push(reference.event);
    scripts.set(reference.script, entry);
  }
  for (const dir of ['.agents/hooks', '.qoder/hooks']) {
    for (const file of listFiles(path.join(root, dir))) {
      const script = `${dir}/${file}`;
      if (!scripts.has(script)) {
        scripts.set(script, {
          script,
          events: [],
          exists: true,
          executable: isExecutable(path.join(root, script)),
        });
      }
    }
  }
  return {
    configPath: '.agents/hooks.json',
    configValid: hooksConfigParsed.ok,
    configError: hooksConfigParsed.error,
    scripts: [...scripts.values()].sort((a, b) => a.script.localeCompare(b.script)),
  };
}

function discoverDirectives(root) {
  const purposes = {
    'AGENTS.md': 'Canonical agent instructions for the monorepo',
    'GEMINI.md': 'Gemini-compatible agent directives',
    'CLAUDE.md': 'Symlinked Claude-compatible directives',
    'AGENT_TRACER.md': 'Consolidated append-only agent audit ledger',
  };
  return Object.entries(purposes).map(([file, purpose]) => {
    const fullPath = path.join(root, file);
    let symlink = false;
    let linkTarget = null;
    try {
      const stat = fs.lstatSync(fullPath);
      symlink = stat.isSymbolicLink();
      if (symlink) linkTarget = fs.readlinkSync(fullPath);
    } catch {
      symlink = false;
    }
    return {
      name: file,
      path: file,
      exists: fs.existsSync(fullPath),
      symlink,
      linkTarget,
      description: purpose,
    };
  });
}

function discoverCoordination(root) {
  const whiteboard = path.join(root, '.agents', 'a2a', 'whiteboard');
  const claimsPath = path.join(whiteboard, 'claims.json');
  const claims = readJson(claimsPath, null);
  const intercom = readJsonl(path.join(whiteboard, 'intercom.jsonl'));
  const eventLog = readJsonl(path.join(root, '.agents', 'a2a', 'bus', 'event-log.jsonl'));
  const canvas = readText(path.join(whiteboard, 'canvas.md'));
  return {
    claims: {
      path: relative(root, claimsPath),
      valid: claims.ok,
      count: Array.isArray(claims.value?.activeClaims) ? claims.value.activeClaims.length : 0,
    },
    canvas: {
      path: relative(root, path.join(whiteboard, 'canvas.md')),
      nonEmpty: canvas.length > 0,
    },
    intercom: {
      path: relative(root, path.join(whiteboard, 'intercom.jsonl')),
      records: intercom.records.length,
      errors: intercom.errors,
    },
    eventLog: {
      path: '.agents/a2a/bus/event-log.jsonl',
      records: eventLog.records.length,
      errors: eventLog.errors,
    },
  };
}

function discoverMemory(root) {
  const files = ['schema.json', 'context-budget.json', 'index.json'];
  return files
    .map((file) => ({ file, path: `.agents/memory_base/${file}` }))
    .filter((entry) => fs.existsSync(path.join(root, entry.path)))
    .map((entry) => {
      const parsed = readJson(path.join(root, entry.path), null);
      return { ...entry, valid: parsed.ok, error: parsed.error };
    });
}

function discoverQoderAgents(root) {
  const base = path.join(root, '.qoder', 'agents');
  return listFiles(base, '.md').map((file) => {
    const content = readText(path.join(base, file));
    const { present, fields } = parseFrontmatter(content);
    return {
      name: typeof fields.name === 'string' ? fields.name : file.replace(/\.md$/, ''),
      path: relative(root, path.join(base, file)),
      description:
        typeof fields.description === 'string' ? fields.description : firstHeading(content),
      frontmatter: present,
    };
  });
}

function discoverComponents(root) {
  const capabilities = discoverSkills(root, '.agents/skills');
  const qoderSkills = discoverSkills(root, '.qoder/skills');
  return {
    agents: discoverAgents(root),
    registry: discoverRegistry(root),
    skills: [...capabilities, ...qoderSkills],
    rules: discoverRules(root),
    schemas: discoverSchemas(root),
    hooks: discoverHooks(root),
    directives: discoverDirectives(root),
    coordination: discoverCoordination(root),
    memory: discoverMemory(root),
    qoderAgents: discoverQoderAgents(root),
  };
}

function componentCounts(components) {
  return {
    agents: components.agents.length,
    registry: components.registry.length,
    skills: components.skills.length,
    rules: components.rules.length,
    schemas: components.schemas.length,
    hookScripts: components.hooks.scripts.length,
    directives: components.directives.filter((entry) => entry.exists).length,
    qoderAgents: components.qoderAgents.length,
  };
}

module.exports = { componentCounts, discoverComponents };
