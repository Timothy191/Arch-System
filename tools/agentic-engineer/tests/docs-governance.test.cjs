'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadConfig } = require('../lib/constants.cjs');
const { evaluateDocs, writeCatalog } = require('../lib/docs-governance.cjs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const baseConfig = loadConfig(ROOT).config;

function temporaryRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ae-docs-'));
}

function configWithRequiredDocs() {
  return {
    ...baseConfig,
    documentation: {
      ...baseConfig.documentation,
      root: 'docs/agents/demo',
      catalog: 'documentation/demo-catalog.md',
      required: [
        {
          id: 'spec',
          path: 'docs/agents/demo/SPEC.md',
          type: 'technical-specification',
          sections: ['Purpose'],
        },
      ],
    },
  };
}

test('evaluateDocs reports missing documents and a stale catalog', () => {
  const root = temporaryRoot();
  try {
    const result = evaluateDocs({ root, config: configWithRequiredDocs() });
    assert.equal(result.ok, false);
    assert.equal(result.catalogUpToDate, false);
    assert.equal(result.completeness < 100, true);
    assert.ok(result.checks.some((check) => check.id === 'spec' && !check.ok));
    assert.ok(result.checks.some((check) => check.id === 'catalog' && !check.ok));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('evaluateDocs reaches 100% once required sections and a fresh catalog exist', () => {
  const root = temporaryRoot();
  try {
    const config = configWithRequiredDocs();
    writeCatalog(root, config);
    const docPath = path.join(root, 'docs/agents/demo/SPEC.md');
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.writeFileSync(
      docPath,
      [
        '# Demo Specification',
        '',
        '## Purpose',
        '',
        'This document exists to prove that the required documentation contract is satisfied',
        'for the demo agent-content surface used by the governance test suite. It is long',
        'enough to clear the minimum content threshold and declares every mandated section.',
        '',
      ].join('\n')
    );
    const result = evaluateDocs({ root, config });
    assert.equal(result.ok, true);
    assert.equal(result.completeness, 100);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('documentation change sync requires docs or catalog changes for agent content', () => {
  const root = temporaryRoot();
  try {
    const config = configWithRequiredDocs();
    writeCatalog(root, config);
    const docPath = path.join(root, 'docs/agents/demo/SPEC.md');
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.writeFileSync(
      docPath,
      '# Demo\n\n## Purpose\n\nEnough content to pass the minimum length threshold for the demo document used in this test. '.repeat(
        3
      )
    );

    const unsynced = evaluateDocs({
      root,
      config,
      changedFiles: ['.agents/agents/demo/agent.md'],
    });
    const syncCheck = unsynced.checks.find((check) => check.id === 'change-sync');
    assert.equal(syncCheck.ok, false);
    assert.deepEqual(syncCheck.agentChanges, ['.agents/agents/demo/agent.md']);

    const synced = evaluateDocs({
      root,
      config,
      changedFiles: ['.agents/agents/demo/agent.md', 'docs/agents/demo/SPEC.md'],
    });
    assert.equal(synced.checks.find((check) => check.id === 'change-sync').ok, true);

    const runtimeOnly = evaluateDocs({
      root,
      config,
      changedFiles: ['.agents/a2a/bus/event-log.jsonl', '.agents/a2a/whiteboard/claims.json'],
    });
    const runtimeCheck = runtimeOnly.checks.find((check) => check.id === 'change-sync');
    assert.equal(runtimeCheck.ok, true);
    assert.deepEqual(runtimeCheck.agentChanges, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
