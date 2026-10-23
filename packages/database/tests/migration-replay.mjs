#!/usr/bin/env node

/**
 * Migration Replay Test
 *
 * Replays the real get_production_summary / refresh_production_summary DDL
 * from migrations 073 and 194 against a throwaway PostgreSQL container using
 * PostgreSQL's default check_function_bodies = on. This reproduces the failure
 * mode fresh installs hit when a SECURITY DEFINER body with search_path = ''
 * references a relation unqualified.
 *
 * Requires Docker. Run: node tests/migration-replay.mjs
 * Override the image with MIGRATION_REPLAY_IMAGE (default postgres:17-alpine).
 */

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { extractCreateFunction } from './sql-extract.mjs';

const IMAGE = process.env.MIGRATION_REPLAY_IMAGE ?? 'postgres:17-alpine';
const CONTAINER = `arch-migration-replay-${randomUUID().slice(0, 8)}`;
const MIGRATIONS = new URL('../migrations/', import.meta.url);

const checks = [];
let fatal = false;

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    input,
    timeout: 300_000,
  });
  if (result.error) {
    return { status: 1, stdout: '', stderr: result.error.message };
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function psql(sql) {
  return run(
    'docker',
    [
      'exec',
      '-i',
      CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'replay',
      '-X',
      '-q',
      '-t',
      '-A',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    sql
  );
}

function record(name, passed, detail = '') {
  checks.push({ name, passed });
  if (passed) {
    console.log(`  ✓ ${name}`);
    return;
  }
  console.error(`  ✗ ${name}`);
  if (detail) {
    console.error(
      detail
        .trim()
        .split('\n')
        .map((line) => `      ${line}`)
        .join('\n')
    );
  }
}

function expectSuccess(name, sql) {
  const result = psql(sql);
  const passed = result.status === 0;
  record(name, passed, passed ? '' : `${result.stderr}${result.stdout}`);
  return passed;
}

function expectFailure(name, sql, fragment) {
  const result = psql(sql);
  const output = `${result.stderr}${result.stdout}`;
  const passed = result.status !== 0 && output.includes(fragment);
  record(
    name,
    passed,
    passed ? '' : `expected a failure containing "${fragment}" (exit ${result.status})\n${output}`
  );
}

function expectValue(name, sql, expected) {
  const result = psql(sql);
  const actual = result.stdout.trim();
  const passed = result.status === 0 && actual === expected;
  record(
    name,
    passed,
    passed
      ? ''
      : `expected "${expected}", got "${actual}" (exit ${result.status})\n${result.stderr}`
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReady() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const state = run('docker', ['inspect', '-f', '{{.State.Running}}', CONTAINER]);
    if (state.status !== 0 || state.stdout.trim() !== 'true') {
      return { ready: false, reason: 'container exited during startup' };
    }

    // The official image starts a temporary server during initdb; wait for the
    // second readiness log before treating the database as available.
    const logs = run('docker', ['logs', CONTAINER]);
    const readyCount =
      `${logs.stdout}${logs.stderr}`.split('database system is ready to accept connections')
        .length - 1;
    if (readyCount >= 2 && psql('SELECT 1;').status === 0) {
      return { ready: true, reason: '' };
    }

    await sleep(500);
  }
  return { ready: false, reason: 'timed out waiting for PostgreSQL' };
}

async function main() {
  const docker = run('docker', ['info', '--format', '{{.ServerVersion}}']);
  if (docker.status !== 0) {
    console.error('\nDocker is required for the migration replay test.');
    console.error(docker.stderr.trim());
    process.exit(2);
  }

  console.log(`\nReplaying migration function DDL against ${IMAGE}\n`);

  const started = run('docker', [
    'run',
    '--detach',
    '--rm',
    '--name',
    CONTAINER,
    '--env',
    'POSTGRES_PASSWORD=replay',
    '--env',
    'POSTGRES_DB=replay',
    IMAGE,
  ]);
  if (started.status !== 0) {
    console.error(`Failed to start ${IMAGE}:`);
    console.error(started.stderr.trim());
    process.exit(1);
  }

  try {
    const readiness = await waitForReady();
    if (!readiness.ready) {
      fatal = true;
      record('PostgreSQL container becomes ready', false, readiness.reason);
      return;
    }

    expectValue(
      'PostgreSQL validates function bodies (check_function_bodies = on)',
      'SHOW check_function_bodies;',
      'on'
    );

    const setup = expectSuccess(
      'stub matview and access helpers are created',
      `
      CREATE TABLE public.view_production_summary (
        daily_log_id uuid PRIMARY KEY,
        department_id uuid NOT NULL,
        log_date date NOT NULL
      );
      CREATE FUNCTION public.has_department_access(p_department_id uuid)
      RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT true $$;
      CREATE FUNCTION public.is_admin()
      RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT true $$;
      `
    );
    if (!setup) {
      fatal = true;
      return;
    }

    expectFailure(
      "unqualified body is rejected under search_path = '' (negative control)",
      `
      CREATE FUNCTION public.unqualified_probe()
      RETURNS SETOF public.view_production_summary
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
        SELECT s.* FROM view_production_summary s;
      $$;
      `,
      'relation "view_production_summary" does not exist'
    );

    const migration073 = readFileSync(
      new URL('073_production_summary_view.sql', MIGRATIONS),
      'utf8'
    );
    const migration194 = readFileSync(
      new URL('194_fix_production_summary_rpc.sql', MIGRATIONS),
      'utf8'
    );

    const statements = [
      [
        '073 get_production_summary',
        extractCreateFunction(migration073, 'public.get_production_summary'),
      ],
      [
        '073 refresh_production_summary',
        extractCreateFunction(migration073, 'refresh_production_summary'),
      ],
      [
        '194 get_production_summary',
        extractCreateFunction(migration194, 'public.get_production_summary'),
      ],
      [
        '194 refresh_production_summary',
        extractCreateFunction(migration194, 'refresh_production_summary'),
      ],
    ];

    for (const [name, statement] of statements) {
      if (!statement) {
        record(`${name} exists`, false, 'statement not found in the migration file');
        continue;
      }
      expectSuccess(`replays ${name} with check_function_bodies = on`, statement);
    }

    expectSuccess(
      'a shift row is inserted for the functional check',
      `
      INSERT INTO public.view_production_summary (daily_log_id, department_id, log_date)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        '2026-10-01'
      );
      `
    );

    expectValue(
      'get_production_summary returns the seeded shift',
      `SELECT count(*) FROM public.get_production_summary('2026-10-01', '2026-10-01');`,
      '1'
    );
    expectValue(
      'get_production_summary keeps the date filter',
      `SELECT count(*) FROM public.get_production_summary('2026-10-02', '2026-10-02');`,
      '0'
    );
    expectValue(
      'get_production_summary is SECURITY DEFINER',
      `SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_production_summary(date,date)'::regprocedure;`,
      't'
    );
    expectValue(
      'get_production_summary keeps search_path pinned',
      `SELECT count(*) FROM pg_proc WHERE oid = 'public.get_production_summary(date,date)'::regprocedure AND array_to_string(proconfig, ',') LIKE 'search_path=%';`,
      '1'
    );
    expectValue(
      '194 installed the schema-qualified RPC body',
      `SELECT count(*) FROM pg_proc WHERE oid = 'public.get_production_summary(date,date)'::regprocedure AND pg_get_functiondef(oid) LIKE '%FROM public.view_production_summary%';`,
      '1'
    );
    expectValue(
      '194 installed the schema-qualified refresh body',
      `SELECT count(*) FROM pg_proc WHERE oid = 'public.refresh_production_summary()'::regprocedure AND pg_get_functiondef(oid) LIKE '%REFRESH MATERIALIZED VIEW public.view_production_summary%';`,
      '1'
    );
  } finally {
    run('docker', ['rm', '--force', CONTAINER]);
  }
}

await main();

const failed = checks.filter((check) => !check.passed);
console.log(
  `\n${checks.length} checks — ${checks.length - failed.length} passed, ${failed.length} failed.\n`
);
process.exit(fatal || failed.length > 0 ? 1 : 0);
