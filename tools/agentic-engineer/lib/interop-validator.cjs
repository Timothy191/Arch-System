'use strict';

/**
 * End-to-end interoperability validator for agent-content components.
 * Produces a deterministic pass/fail matrix that the gate, health monitor,
 * and test suite all consume.
 */

const fs = require('node:fs');
const path = require('node:path');

const { runEnvelopeRoundtrip } = require('./a2a.cjs');
const { discoverComponents } = require('./component-registry.cjs');
const { readJson, truncate } = require('./util.cjs');

const { validateSkillDirectory } = require('../../audits/validate-agent-skill.cjs');

const REGISTRY_PILLARS = [
  'name',
  'mode',
  'description',
  'runtime',
  'permissions',
  'scope',
  'runbook',
  'negative_constraints',
  'input_contract',
  'output_contract',
  'recovery_protocol',
];

function check(id, title, severity, failures, details = []) {
  return {
    id,
    title,
    severity,
    status: failures.length === 0 ? 'pass' : 'fail',
    failures,
    details,
  };
}

function validateAgentParity(components) {
  const agentNames = new Set(components.agents.map((entry) => entry.name));
  const registryNames = new Set(components.registry.map((entry) => entry.name));
  const failures = [];
  for (const name of agentNames) {
    if (!registryNames.has(name)) failures.push(`agent "${name}" has no A2A registry card`);
  }
  for (const name of registryNames) {
    if (!agentNames.has(name)) failures.push(`registry card "${name}" has no agent definition`);
  }
  return check(
    'agents.parity',
    'Agent definitions and registry cards are paired',
    'critical',
    failures
  );
}

function validateAgentFrontmatter(components) {
  const required = ['name', 'mode', 'model', 'temperature', 'max_steps', 'description'];
  const failures = [];
  for (const agent of components.agents) {
    if (!agent.frontmatter) {
      failures.push(`${agent.path} is missing YAML frontmatter`);
      continue;
    }
    if (agent.fields.name !== agent.name) {
      failures.push(`${agent.path} name "${agent.fields.name}" does not match directory`);
    }
    for (const field of required) {
      if (agent.fields[field] === undefined || agent.fields[field] === '') {
        failures.push(`${agent.path} is missing frontmatter field "${field}"`);
      }
    }
    if (typeof agent.fields.permissions !== 'object') {
      failures.push(`${agent.path} is missing permissions mapping`);
    }
    if (typeof agent.fields.scope !== 'object') {
      failures.push(`${agent.path} is missing scope mapping`);
    }
  }
  return check(
    'agents.frontmatter',
    'Agent definitions satisfy the 9-pillar frontmatter',
    'critical',
    failures
  );
}

function validateRegistryPillars(components) {
  const failures = [];
  for (const entry of components.registry) {
    if (!entry.valid) {
      failures.push(`${entry.path} is not valid JSON: ${entry.error}`);
      continue;
    }
    for (const pillar of REGISTRY_PILLARS) {
      if (entry.data[pillar] === undefined) {
        failures.push(`${entry.path} is missing pillar "${pillar}"`);
      }
    }
    const runtime = entry.data.runtime || {};
    if (typeof runtime.model !== 'string') failures.push(`${entry.path} runtime.model missing`);
    if (typeof runtime.temperature !== 'number') {
      failures.push(`${entry.path} runtime.temperature missing`);
    }
    if (typeof runtime.max_steps !== 'number')
      failures.push(`${entry.path} runtime.max_steps missing`);
    const runbook = entry.data.runbook;
    if (!Array.isArray(runbook) || runbook.length < 3) {
      failures.push(`${entry.path} runbook must contain at least 3 phases`);
    }
    const constraints = entry.data.negative_constraints;
    if (!Array.isArray(constraints) || constraints.length < 1) {
      failures.push(`${entry.path} negative_constraints must not be empty`);
    }
  }
  return check(
    'registry.pillars',
    'Registry cards implement every A2A pillar',
    'critical',
    failures
  );
}

function validateOutputContracts(components) {
  const failures = [];
  const schemaNames = new Set(components.schemas.map((entry) => entry.name));
  for (const entry of components.registry) {
    const contract = entry.data.output_contract;
    const schemaPath = contract && typeof contract.schema === 'string' ? contract.schema : '';
    if (!schemaPath) {
      const inline = contract && typeof contract === 'object' && Object.keys(contract).length > 0;
      if (!inline) failures.push(`${entry.path} has no output contract`);
      continue;
    }
    if (!fs.existsSync(path.join(components.root, schemaPath))) {
      failures.push(`${entry.path} references missing schema ${schemaPath}`);
      continue;
    }
    const schema = readJson(path.join(components.root, schemaPath), null);
    if (!schema.ok) {
      failures.push(`${entry.path} output schema ${schemaPath} is not valid JSON`);
      continue;
    }
    if (!schema.value.type && !schema.value.properties) {
      failures.push(`${entry.path} output schema ${schemaPath} lacks a type contract`);
    }
    const schemaName = path.basename(schemaPath).replace(/\.schema\.json$/, '');
    if (
      schemaNames.size > 0 &&
      !schemaNames.has(schemaName) &&
      !schemaNames.has(`${schemaName}.schema`)
    ) {
      failures.push(`${entry.path} output schema ${schemaPath} is outside .agents/a2a/schemas`);
    }
  }
  return check(
    'registry.output_contracts',
    'Registry output contracts resolve to schemas',
    'critical',
    failures
  );
}

function validateSkillsManifest(root, components) {
  const failures = [];
  const manifest = readJson(path.join(root, '.agents', 'skills.json'), null);
  if (!manifest.ok) {
    return check(
      'skills.manifest',
      'Skills manifest resolves',
      'major',
      [],
      ['No .agents/skills.json manifest present; manifest check skipped.']
    );
  }
  const available = new Set(components.skills.map((entry) => entry.directory));
  for (const entry of manifest.value.entries || []) {
    for (const name of entry.include_only || []) {
      if (!available.has(name)) failures.push(`skills.json references missing skill "${name}"`);
    }
  }
  return check('skills.manifest', 'Skills manifest resolves', 'major', failures);
}

function validateSkillValidity(root, components) {
  const failures = [];
  for (const skill of components.skills) {
    const skillDir = path.join(root, path.dirname(skill.path));
    const result = validateSkillDirectory(skillDir);
    for (const error of result.errors) {
      failures.push(`${skill.path}: ${error.type} — ${error.description}`);
    }
  }
  return check(
    'skills.validity',
    'Skill packages satisfy the Agent Skills specification',
    'critical',
    failures
  );
}

function validateSkillDuplicates(components) {
  const seen = new Map();
  const failures = [];
  for (const skill of components.skills) {
    const existing = seen.get(skill.directory);
    if (existing && existing.root !== skill.root) {
      failures.push(
        `skill "${skill.directory}" is defined in both ${existing.root} and ${skill.root}`
      );
    } else {
      seen.set(skill.directory, skill);
    }
  }
  return check('skills.duplicates', 'Skill names are unique across roots', 'major', failures);
}

function validateRules(components) {
  const failures = [];
  const withoutFrontmatter = [];
  for (const rule of components.rules) {
    if (!rule.nonEmpty) failures.push(`${rule.path} is empty`);
    if (!rule.frontmatter) withoutFrontmatter.push(rule.path);
  }
  return check('rules.integrity', 'Rules are non-empty and discoverable', 'critical', failures, [
    withoutFrontmatter.length === 0
      ? 'All rule files declare frontmatter.'
      : `${withoutFrontmatter.length} legacy rule file(s) use heading-only metadata.`,
  ]);
}

function validateSchemas(components) {
  const failures = [];
  for (const schema of components.schemas) {
    if (!schema.valid) {
      failures.push(`${schema.path} is not valid JSON: ${schema.error}`);
      continue;
    }
    if (!schema.data.$schema) failures.push(`${schema.path} is missing $schema`);
    if (!schema.data.type && !schema.data.properties) {
      failures.push(`${schema.path} is missing a type/properties contract`);
    }
  }
  return check(
    'schemas.valid',
    'A2A JSON schemas parse and declare contracts',
    'critical',
    failures
  );
}

function validateHooks(components) {
  const failures = [];
  if (!components.hooks.configValid) {
    failures.push(`.agents/hooks.json is invalid: ${components.hooks.configError}`);
  }
  for (const script of components.hooks.scripts) {
    if (!script.exists) failures.push(`hook script ${script.script} is referenced but missing`);
    if (script.events.length > 0 && !script.executable) {
      failures.push(`hook script ${script.script} is referenced but not executable`);
    }
  }
  return check(
    'hooks.integrity',
    'Hook registry commands resolve to executable scripts',
    'major',
    failures
  );
}

function validateCoordination(components) {
  const failures = [];
  if (!components.coordination.claims.valid) failures.push('whiteboard claims.json is invalid');
  for (const error of components.coordination.intercom.errors) {
    failures.push(`intercom.jsonl line ${error.line}: ${error.message}`);
  }
  for (const error of components.coordination.eventLog.errors) {
    failures.push(`event-log.jsonl line ${error.line}: ${error.message}`);
  }
  if (!components.coordination.canvas.nonEmpty) failures.push('whiteboard canvas.md is empty');
  return check(
    'coordination.state',
    'A2A coordination state files are readable',
    'major',
    failures
  );
}

function validateDirectives(components) {
  const failures = [];
  for (const directive of components.directives) {
    if (!directive.exists) {
      failures.push(`${directive.path} is missing`);
      continue;
    }
    const content = fs.readFileSync(path.join(components.root, directive.path), 'utf8');
    if (content.trim().length === 0) failures.push(`${directive.path} is empty`);
  }
  const claude = components.directives.find((entry) => entry.path === 'CLAUDE.md');
  if (claude?.exists && !claude.symlink) {
    failures.length === 0 &&
      failures.push('CLAUDE.md should be a symlink to GEMINI.md to avoid drift');
  }
  return check(
    'directives.integrity',
    'Root agent directives exist and resolve',
    'critical',
    failures
  );
}

function validateA2ARoundtrip(components) {
  const sender = components.registry.some((entry) => entry.name === 'agentic-engineer')
    ? 'agentic-engineer'
    : 'core-coordinator';
  const recipient = components.registry.find((entry) => entry.name !== sender);
  const result = runEnvelopeRoundtrip({
    sender,
    recipient: recipient ? recipient.name : sender,
  });
  const failures = result.results
    .filter((entry) => !entry.ok)
    .map((entry) => `${entry.kind} envelope failed validation`);
  return check(
    'a2a.envelope_roundtrip',
    'Handoff, verdict, and heartbeat envelopes interoperate',
    'critical',
    failures
  );
}

function validateMemory(components) {
  const failures = [];
  for (const file of components.memory) {
    if (!file.valid) failures.push(`${file.path} is invalid JSON: ${file.error}`);
  }
  return check('memory.integrity', 'Memory-base configuration files parse', 'major', failures);
}

function runInteropValidation(root) {
  const components = discoverComponents(root);
  components.root = root;
  const checks = [
    validateAgentParity(components),
    validateAgentFrontmatter(components),
    validateRegistryPillars(components),
    validateOutputContracts(components),
    validateSkillsManifest(root, components),
    validateSkillValidity(root, components),
    validateSkillDuplicates(components),
    validateRules(components),
    validateSchemas(components),
    validateHooks(components),
    validateCoordination(components),
    validateDirectives(components),
    validateA2ARoundtrip(components),
    validateMemory(components),
  ];
  const passed = checks.filter((entry) => entry.status === 'pass').length;
  const violations = checks.flatMap((entry) =>
    entry.failures.map((message) => ({
      checkId: entry.id,
      severity: entry.severity,
      message: truncate(message, 240),
    }))
  );
  return {
    ok: passed === checks.length,
    score: Math.round((passed / checks.length) * 1000) / 10,
    total: checks.length,
    passed,
    failed: checks.length - passed,
    checks,
    violations,
    components,
    counts: {
      agents: components.agents.length,
      registry: components.registry.length,
      skills: components.skills.length,
      rules: components.rules.length,
      schemas: components.schemas.length,
      hooks: components.hooks.scripts.length,
    },
  };
}

module.exports = { REGISTRY_PILLARS, runInteropValidation };
