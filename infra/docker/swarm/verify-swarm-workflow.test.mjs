// cspell:ignore healthcheck pipefail
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const SWARM_DIR = path.join(REPO_ROOT, 'infra/docker/swarm');
const STACK_FILE = path.join(SWARM_DIR, 'stack.arch-system.yml');
const DEPLOY_SCRIPT = path.join(SWARM_DIR, 'deploy-swarm.sh');
const CONDUCTOR_TRACKS_MD = path.join(REPO_ROOT, 'conductor/tracks.md');
const TRACK_DIR = path.join(REPO_ROOT, 'conductor/tracks/docker_swarm_deploy_20261126');

const SYNTHETIC_ENV = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-test-anon-key',
};

test('deploy-swarm.sh exists, is executable, uses strict mode, and passes bash -n', () => {
  assert.ok(fs.existsSync(DEPLOY_SCRIPT), 'deploy-swarm.sh must exist');
  const stats = fs.statSync(DEPLOY_SCRIPT);
  assert.notEqual(stats.mode & 0o111, 0, 'deploy-swarm.sh must be executable');

  const source = fs.readFileSync(DEPLOY_SCRIPT, 'utf8');
  assert.match(source, /^#!\/usr\/bin\/env bash/m);
  assert.match(source, /^set -euo pipefail/m);
  assert.match(source, /docker stack deploy/);
  assert.match(source, /docker service rollback/);

  const syntaxCheck = spawnSync('bash', ['-n', DEPLOY_SCRIPT], { encoding: 'utf8' });
  assert.equal(syntaxCheck.status, 0, `bash -n failed: ${syntaxCheck.stderr}`);
});

test('stack.arch-system.yml passes docker stack config and enforces Swarm invariants', () => {
  assert.ok(fs.existsSync(STACK_FILE), 'stack.arch-system.yml must exist');
  const rawYaml = fs.readFileSync(STACK_FILE, 'utf8');

  // Ensure zero hardcoded secret tokens in stack manifest
  const secretPatterns = [
    /sk-[A-Za-z0-9]{20,}/,
    /ghp_[A-Za-z0-9]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\./,
  ];
  for (const pattern of secretPatterns) {
    assert.doesNotMatch(rawYaml, pattern, `Unexpected secret pattern ${pattern} in stack YAML`);
  }

  const rendered = execFileSync('docker', ['stack', 'config', '-c', STACK_FILE], {
    cwd: SWARM_DIR,
    env: SYNTHETIC_ENV,
    encoding: 'utf8',
  });

  // Core services
  for (const service of ['portal:', 'redis:', 'caddy:']) {
    assert.ok(rendered.includes(service), `Rendered stack must include service ${service}`);
  }

  // Rolling rollback + start-first + resource limits + healthchecks
  assert.equal(
    (rendered.match(/failure_action:\s*rollback/g) || []).length >= 3,
    true,
    'All 3 services must configure update_config failure_action: rollback'
  );
  assert.equal(
    (rendered.match(/rollback_config:/g) || []).length >= 3,
    true,
    'All 3 services must configure rollback_config'
  );
  assert.equal(
    (rendered.match(/healthcheck:/g) || []).length >= 3,
    true,
    'All 3 services must configure healthcheck'
  );
  assert.equal(
    (rendered.match(/order:\s*start-first/g) || []).length >= 2,
    true,
    'portal and caddy must configure start-first updates/rollbacks'
  );
  assert.match(rendered, /fetch\('http:\/\/127\.0\.0\.1:3000\/api\/health'\)/);

  // Encrypted internal overlay + public overlay
  assert.match(rendered, /arch_internal:/);
  assert.match(rendered, /encrypted:\s*"?true"?/);
  assert.match(rendered, /arch_public:/);

  // External Docker secrets contract
  for (const secretName of [
    'arch_supabase_service_key',
    'arch_database_url',
    'arch_redis_password',
    'arch_cron_secret',
    'arch_webhook_secret',
  ]) {
    assert.ok(rendered.includes(secretName), `Missing external secret ${secretName}`);
  }
  assert.equal(
    (rendered.match(/external:\s*true/g) || []).length >= 5,
    true,
    'All 5 secrets must be declared external: true'
  );
});

test('deploy-swarm.sh --dry-run executes idempotently without mutating Swarm', () => {
  for (let run = 1; run <= 2; run++) {
    const res = spawnSync(DEPLOY_SCRIPT, ['--dry-run'], {
      cwd: REPO_ROOT,
      env: SYNTHETIC_ENV,
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, `--dry-run run #${run} failed: ${res.stderr}`);
    assert.match(res.stdout, /\[DRY-RUN\]/);
    assert.match(res.stdout, /docker stack deploy --prune/);
    assert.match(res.stdout, /http:\/\/127\.0\.0\.1:8080\/api\/health/);
  }

  // Verify --local-image uses --resolve-image never
  const localRes = spawnSync(DEPLOY_SCRIPT, ['--dry-run', '--local-image'], {
    cwd: REPO_ROOT,
    env: SYNTHETIC_ENV,
    encoding: 'utf8',
  });
  assert.equal(localRes.status, 0, `--local-image failed: ${localRes.stderr}`);
  assert.match(localRes.stdout, /--resolve-image never/);
  assert.doesNotMatch(localRes.stdout, /--with-registry-auth/);

  // Verify custom http port overrides probe URL
  const portRes = spawnSync(DEPLOY_SCRIPT, ['--dry-run', '--http-port', '9090'], {
    cwd: REPO_ROOT,
    env: SYNTHETIC_ENV,
    encoding: 'utf8',
  });
  assert.equal(portRes.status, 0, `--http-port failed: ${portRes.stderr}`);
  assert.match(portRes.stdout, /http:\/\/127\.0\.0\.1:9090\/api\/health/);
});

test('deploy-swarm.sh --validate-only and --help behave as documented', () => {
  const validateRes = spawnSync(DEPLOY_SCRIPT, ['--validate-only'], {
    cwd: REPO_ROOT,
    env: SYNTHETIC_ENV,
    encoding: 'utf8',
  });
  assert.equal(validateRes.status, 0, `--validate-only failed: ${validateRes.stderr}`);
  assert.match(validateRes.stdout, /Validation-only mode complete/);

  const helpRes = spawnSync(DEPLOY_SCRIPT, ['--help'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(helpRes.status, 0);
  assert.match(helpRes.stdout, /--dry-run/);
  assert.match(helpRes.stdout, /--validate-only/);

  const badRes = spawnSync(DEPLOY_SCRIPT, ['--unknown-flag'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.notEqual(badRes.status, 0, 'Unknown flag must exit non-zero');
});

test('Conductor track artifacts exist and are registered in conductor/tracks.md', () => {
  for (const file of ['spec.md', 'plan.md', 'index.md', 'metadata.json']) {
    assert.ok(fs.existsSync(path.join(TRACK_DIR, file)), `Missing track file ${file}`);
  }
  const tracksMd = fs.readFileSync(CONDUCTOR_TRACKS_MD, 'utf8');
  assert.match(tracksMd, /docker_swarm_deploy_20261126/);
});
