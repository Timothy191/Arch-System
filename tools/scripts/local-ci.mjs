#!/usr/bin/env node
/**
 * Local stand-in for the Arch-System CI job matrix.
 *
 * GitHub Actions can be unavailable to this account (billing lock, runner
 * outage), which leaves pushes with no server-side verification at all. This
 * replays the runnable subset of the gate workflows locally, against either the
 * current checkout or an isolated worktree for a pull request, and reports the
 * steps that have no local equivalent so their coverage loss is explicit.
 *
 * Steps are matched by "<job> :: <step name>" against an allowlist, so a step
 * can never execute something that was not reviewed here. Unrecognised steps
 * are reported UNMAPPED instead of run.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATE_WORKFLOWS = ['ci.yml', 'ga.yml', 'theme-ci.yml'];
const REPORT_DIR = path.join(REPO, '.ci-local');
const INSTALL_CMD = 'pnpm install --frozen-lockfile';

const GITLEAKS_CONFIG = 'config/tools/.gitleaks.toml';

// npm/pnpm insert a literal `--` between the script name and its arguments.
const CLI_ARGS = process.argv.slice(2).filter((tok) => tok !== '--');

const opts = parseArgs({
  args: CLI_ARGS,
  options: {
    pr: { type: 'string' },
    jobs: { type: 'string' },
    suite: { type: 'string', default: 'core' },
    redis: { type: 'string', default: 'auto' },
    worktree: { type: 'string' },
    'no-install': { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    list: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});
const arg = (name) => opts.values[name];
const SUITE = arg('suite');
const DRY = arg('dry-run') || arg('list');

const HELP = `local-ci - replay the CI job matrix without GitHub Actions

  pnpm ci:local                      core suite against the current checkout
  pnpm ci:local -- --suite=full      add build/test/integration/e2e jobs
  pnpm ci:local -- --pr=182          validate a pull request in an isolated worktree
  pnpm ci:local -- --jobs=policy-check,knip
  pnpm ci:local -- --list            print the resolved plan without executing

  --suite=core|full   --redis=auto|off   --no-install   --keep   --dry-run
`;

/** Environment that the CI jobs inject, minus anything secret. */
const CI_ENV = {
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://mrwhtxbhrzyttlsyuofc.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'dummy-anon-key-for-ci',
  SUPABASE_URL: 'https://mrwhtxbhrzyttlsyuofc.supabase.co',
  SUPABASE_ANON_KEY: 'dummy-anon-key-for-ci',
  SUPABASE_SERVICE_KEY: 'dummy-service-key-for-ci',
  PAYLOAD_SECRET: 'dummy-payload-secret-for-ci',
  PORT: '3000',
  N8N_URL: 'http://localhost:5678',
  FLOWISE_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
};

const has = (cmd) => spawnSync('which', [cmd], { stdio: 'ignore' }).status === 0;
const git = (args, cwd = process.cwd()) =>
  spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, HUSKY: '0' } });
const gitOk = (args, cwd = process.cwd()) => git(args, cwd).status === 0;

function run(argv, cwd, env) {
  const cmd = argv.join(' ');
  if (DRY) return { status: 'PLAN', code: null, cmd };
  const res = spawnSync(argv[0], argv.slice(1), {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...CI_ENV, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: res.status === 0 ? 'PASS' : 'FAIL',
    code: res.status,
    cmd,
    out: res.stdout || '',
    err: res.stderr || '',
  };
}

/* -------------------------------------------------------------------------- */
/* Workflow parsing                                                           */
/* -------------------------------------------------------------------------- */

function parseWorkflow(file) {
  const lines = fs
    .readFileSync(path.join(REPO, '.github', 'workflows', file), 'utf8')
    .split(/\r?\n/);
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start < 0) return [];
  const indentOf = (l) => l.match(/^ */)[0].length;
  const jobs = [];
  const state = { jobIndent: null, job: null, step: null, block: null, inSteps: false };

  const applyProp = (step, text, keyIndent) => {
    const kv = text.match(/^([-\w]+):\s*(.*)$/);
    if (!kv) return;
    const [, k, rest] = kv;
    const v = rest.trim();
    if (k === 'name') step.name ??= v;
    else if (k === 'uses') step.uses ??= v;
    else if (k === 'working-directory') step.workingDirectory = v;
    else if (k === 'run') {
      if (/^[|>][-+]?$/.test(v)) state.block = { indent: keyIndent + 2, value: [], step };
      else step.run = v;
    }
  };

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const ind = indentOf(line);
    const text = line.trim();

    if (state.block) {
      if (ind >= state.block.indent) {
        state.block.value.push(line.slice(state.block.indent));
        continue;
      }
      state.block.step.run = state.block.value.join('\n').trim();
      state.block = null;
    }
    if (ind === 0) break; // left the jobs block

    if (/^\w[\w-]*:\s*$/.test(text)) {
      if (state.jobIndent === null) state.jobIndent = ind;
      if (ind === state.jobIndent) {
        state.job = { key: text.match(/^([\w-]+):/)[1], display: null, steps: [], file };
        jobs.push(state.job);
        state.step = null;
        state.inSteps = false;
        continue;
      }
    }
    if (!state.job) continue;
    if (/^steps:\s*$/.test(text)) {
      state.inSteps = true;
      continue;
    }

    if (!state.step && /^name:\s*\S/.test(text)) {
      state.job.display = text.slice('name:'.length).trim();
      continue;
    }
    if (state.inSteps && (text === '-' || text.startsWith('- '))) {
      state.step = {};
      state.job.steps.push(state.step);
      applyProp(state.step, text.replace(/^-\s*/, ''), ind + 2);
      continue;
    }
    if (!state.step) continue;
    applyProp(state.step, text, ind);
  }
  if (state.block) state.block.step.run = state.block.value.join('\n').trim();
  return jobs;
}

function stepLabel(step) {
  if (step.name) return step.name;
  if (step.uses) return `uses ${step.uses}`;
  return `run ${(step.run || '').split('\n')[0]}`;
}

/* -------------------------------------------------------------------------- */
/* Local plan                                                                 */
/* -------------------------------------------------------------------------- */

const pnpm = (...a) => ['pnpm', ...a];
const turboChanged = (tasks) => {
  const base = gitOk(['rev-parse', '-q', 'origin/main']) ? 'origin/main' : 'HEAD~1';
  return ['pnpm', 'turbo', 'run', ...tasks, `--filter=...[${base}]`];
};

/** @type {Record<string, {build?: (ctx)=>string[][], cmd?: string[], suite, wd?, needs?, env?, soft?, note?}>} */
const LOCAL_STEPS = {
  'deps-lint :: Run syncpack deps lint': { cmd: pnpm('deps:lint'), suite: 'core' },

  'security-audit :: Run dependency audit': {
    cmd: pnpm('audit', '--audit-level=high', '--prod'),
    suite: 'core',
  },
  'security-audit :: Secret scan (gitleaks)': {
    suite: 'core',
    needs: ['docker'],
    build: (ctx) => [
      'docker',
      'run',
      '--rm',
      '-v',
      `${ctx.cwd}:/repo`,
      ...(ctx.gitDir ? ['-v', `${ctx.gitDir}:${ctx.gitDir}`] : []),
      '-w',
      '/repo',
      'zricethezav/gitleaks:latest',
      'detect',
      '--source=/repo',
      `--config=/repo/${GITLEAKS_CONFIG}`,
      '--redact',
      '--exit-code=0',
    ],
    note: 'docker substitute for gitleaks/gitleaks-action (CI points GITLEAKS_CONFIG at a root .gitleaks.toml that does not exist; the real config is in config/tools/)',
  },

  'knip :: Run Knip': { cmd: pnpm('knip'), suite: 'core' },

  'policy-check :: Run Policy Check': { cmd: pnpm('policy:check'), suite: 'core' },
  'policy-check :: Check Migration Drift': {
    cmd: pnpm('--filter', '@repo/database', 'check-migrations'),
    suite: 'core',
  },
  'policy-check :: Lint Changed Migrations (Squawk + RLS)': {
    cmd: pnpm('--filter', '@repo/database', 'lint:migrations'),
    suite: 'core',
  },
  'policy-check :: Replay Production Summary Migrations': {
    cmd: pnpm('--filter', '@repo/database', 'test:migration-replay'),
    suite: 'full',
    needs: ['postgres'],
    note: 'requires a reachable PostgreSQL instance',
  },
  'policy-check :: Check Circular Dependencies': { cmd: pnpm('cycles'), suite: 'core' },
  'policy-check :: Tailwind Utility Composition': { cmd: pnpm('audit:tailwind'), suite: 'core' },

  'html-meta-check :: Run HTML Meta Tags Check': { cmd: pnpm('html:check'), suite: 'core' },
  'md-lint :: Run Markdown Lint': {
    cmd: pnpm('md:lint'),
    suite: 'core',
    note: 'fails on pre-existing debt (measured 2026-10-23: ~10,900 findings, ~9,570 of them MD013 line-length, mostly AGENT_TRACER.md and temp/ files that the tracer convention writes as single long lines)',
  },

  'quality :: Run tflint': {
    cmd: ['tflint', '--recursive'],
    suite: 'full',
    needs: ['tflint'],
    wd: 'infra/redis/terraform',
  },
  'quality :: Run DeepEval AI Compliance Tests': {
    cmd: ['poetry', 'run', 'deepeval', 'test', 'run', 'tests/'],
    suite: 'full',
    needs: ['poetry'],
    wd: 'packages/eval',
    note: 'CI installs poetry with pipx first',
  },
  'quality :: Run Turbo Tasks': {
    suite: 'full',
    build: (ctx) =>
      ctx.mode === 'pr'
        ? [
            turboChanged(['lint', 'type-check', 'lint:tokens', 'lint:css', 'build']),
            turboChanged(['test']),
          ]
        : [pnpm('lint'), pnpm('type-check'), pnpm('test'), ['pnpm', 'turbo', 'run', 'build']],
    note: 'expands to lint, type-check, test, build',
  },
  'quality :: Bundle Size Check': {
    cmd: pnpm('bundlesize'),
    suite: 'full',
    note: 'needs a prior build',
  },

  'redis-integration :: Run Redis integration tests': {
    cmd: pnpm('--filter', 'portal', 'test:integration'),
    suite: 'full',
    needs: ['redis'],
    env: { REDIS_INTEGRATION: '1' },
  },
  'redis-integration :: Run Redis primitives integration tests': {
    cmd: pnpm('--filter', '@repo/redis', 'test:integration'),
    suite: 'full',
    needs: ['redis'],
    env: { REDIS_INTEGRATION: '1' },
  },

  'e2e :: Build': { cmd: pnpm('turbo', 'run', 'build', '--filter=portal'), suite: 'full' },
  'e2e :: Install Playwright Browsers': {
    suite: 'full',
    soft: true,
    build: () => [['npx', 'playwright', 'install', 'chromium']],
    note: 'local equivalent omits CI sudo --with-deps',
  },
  'e2e :: Run Playwright E2E Tests (Visual Regression)': {
    cmd: pnpm('test:e2e'),
    suite: 'full',
    needs: ['playwright'],
    note: 'CI installs chromium first (npx playwright install --with-deps)',
  },
  'lighthouse :: Build': { cmd: pnpm('turbo', 'run', 'build', '--filter=portal'), suite: 'full' },
  'lighthouse :: Run Lighthouse CI': {
    cmd: ['npx', '@lhci/cli@0.14.x', 'autorun'],
    suite: 'full',
    needs: ['lhci'],
  },
  'a11y :: Build Storybook': {
    cmd: pnpm('turbo', 'run', 'build-storybook', '--filter=@repo/ui'),
    suite: 'full',
  },
  'a11y :: Install Playwright Browsers': {
    suite: 'full',
    soft: true,
    build: () => [['npx', 'playwright', 'install', 'chromium']],
    note: 'local equivalent omits CI sudo --with-deps',
  },
  'a11y :: Run A11y Audit': {
    cmd: pnpm('test:a11y'),
    suite: 'full',
    needs: ['playwright'],
    wd: 'packages/ui',
  },

  'self-healing :: Run Self-Healing CI': {
    suite: 'core',
    build: () => [[...turboChanged(['lint']), '--force']],
  },

  'ga-hardening :: Enforce Node 24 runtime alignment': {
    suite: 'core',
    soft: true,
    build: () => [
      [
        'node',
        '-e',
        "const m=process.versions.node.split('.')[0]; if(m!=='24'){console.error('node '+m+' != 24');process.exit(1)}",
      ],
    ],
    note: 'local node is v' + process.versions.node + '; CI fails the job off v24',
  },
  'ga-hardening :: Verify RLS Coverage Matrix (90/90 tables)': {
    cmd: ['node', 'tools/audits/audit-rls-matrix.cjs'],
    suite: 'core',
  },
  'ga-hardening :: Contract drift audit (88/88 Zod parity)': {
    cmd: pnpm('audit:contract'),
    suite: 'core',
  },
  'ga-hardening :: Full monorepo Turbo build and quality gates': {
    suite: 'full',
    build: () => [pnpm('turbo', 'run', 'lint', 'type-check', 'test', 'build')],
  },
  'eval-gates :: Run DeepEval evaluation gate': {
    cmd: pnpm('--filter', '@repo/eval', 'test:eval', '--', '--ci', '--runInBand'),
    suite: 'full',
    note: 'pytest wrapper skips silently when neither poetry nor uv is installed',
  },

  'build-and-lint :: Build theme': { cmd: pnpm('--filter', '@repo/theme', 'build'), suite: 'full' },
  'build-and-lint :: Token drift check': {
    cmd: pnpm('--filter', '@repo/theme', 'lint:tokens'),
    suite: 'core',
  },
  'build-and-lint :: Verify no uncommitted build artifacts': {
    suite: 'full',
    build: () => [
      [
        'node',
        '-e',
        'const {spawnSync}=require("node:child_process");const r=spawnSync("git",["status","--porcelain"],{encoding:"utf8"});if(r.stdout.trim()){console.error(r.stdout);process.exit(1)}',
      ],
    ],
    note: 'CI asserts theme codegen output is already committed',
  },
  'visual-smoke :: Build portal': { cmd: pnpm('--filter', 'portal', 'build'), suite: 'full' },
  'visual-smoke :: Run visual smoke tests': {
    cmd: pnpm('test:e2e:visual'),
    suite: 'full',
    needs: ['playwright'],
  },
};

const GITHUB_ONLY =
  /^(actions\/|github\/|pnpm\/|anchore\/|aquasecurity\/|terraform-linters\/|gitleaks\/|netlify\/|vercel\/)/;

/** Runner plumbing in the workflows: not a check, so never reported as a gap. */
const CI_PLUMBING = new Set(['ga-hardening :: Get pnpm store directory']);

/**
 * GitHub-hosted bootstrap (checkout, toolchain install, artifact cache). Locally
 * these are already satisfied by the checkout being run against, so they are not
 * coverage gaps — only real checks belong in the gap list.
 */
const RUNNER_BOOTSTRAP =
  /^(actions\/checkout|pnpm\/action-setup|actions\/setup-|actions\/cache|actions\/upload-artifact|actions\/download-artifact)/;

function classify(job, step) {
  const label = stepLabel(step);
  const key = `${job} :: ${label}`;
  if ((step.run || '').replace(/\s+/g, ' ').trim() === INSTALL_CMD) return { key, kind: 'install' };
  if (CI_PLUMBING.has(key)) return { key, kind: 'plumbing' };
  const plan = LOCAL_STEPS[key];
  if (plan) return { key, kind: 'local', plan };
  if (step.uses) {
    if (GITHUB_ONLY.test(step.uses))
      return { key, kind: 'github', uses: step.uses, bootstrap: RUNNER_BOOTSTRAP.test(step.uses) };
    return { key, kind: 'unmapped', detail: step.uses };
  }
  return { key, kind: 'unmapped', detail: (step.run || '').split('\n')[0].slice(0, 80) };
}

/* -------------------------------------------------------------------------- */
/* Redis container helper                                                     */
/* -------------------------------------------------------------------------- */

function redisReachable() {
  return (
    spawnSync('redis-cli', ['-p', '6379', 'ping'], { encoding: 'utf8' }).stdout?.trim() === 'PONG'
  );
}

function ensureRedis(log) {
  if (redisReachable()) {
    log('redis: reusing the instance already listening on 6379');
    return () => {};
  }
  if (!has('docker') || arg('redis') === 'off') {
    log('redis: nothing on 6379 and no docker, integration suites will be skipped');
    return null;
  }
  const name = 'arch-local-ci-redis';
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  const up = spawnSync(
    'docker',
    ['run', '-d', '--rm', '--name', name, '-p', '6379:6379', 'redis:7.4-alpine'],
    {
      encoding: 'utf8',
    }
  );
  if (up.status !== 0) {
    log(`redis: could not start the container (${(up.stderr || '').trim().slice(0, 120)})`);
    return null;
  }
  for (let i = 0; i < 30 && !redisReachable(); i += 1) spawnSync('sleep', ['0.5']);
  log('redis: started redis:7.4-alpine for this run');
  return () => {
    spawnSync('docker', ['stop', name], { stdio: 'ignore' });
    log('redis: container stopped');
  };
}

/* -------------------------------------------------------------------------- */
/* Pull-request worktree                                                      */
/* -------------------------------------------------------------------------- */

function prWorktree(number) {
  const info = spawnSync('gh', ['pr', 'view', number, '--json', 'headRefName,baseRefName,title'], {
    cwd: REPO,
    encoding: 'utf8',
  });
  if (info.status !== 0) {
    throw new Error(`gh pr view ${number} failed: ${(info.stderr || '').trim()}`);
  }
  const meta = JSON.parse(info.stdout);
  const fetch = git(
    ['fetch', '--force', 'origin', `pull/${number}/head:refs/ci-local/pr-${number}`],
    REPO
  );
  if (fetch.status !== 0)
    throw new Error(`fetching pull/${number}/head failed: ${fetch.stderr.trim()}`);
  const mergeBase = git(['merge-base', 'HEAD', `refs/ci-local/pr-${number}`], REPO).stdout.trim();
  const behind = Number(
    git(['rev-list', '--count', `${mergeBase}..HEAD`], REPO).stdout.trim() || 0
  );

  const dir = arg('worktree') || path.join(REPO, '.ci-local', 'worktrees', `pr-${number}`);
  const cleanup = () => {
    if (DRY) return;
    if (!arg('keep')) git(['worktree', 'remove', '--force', dir], REPO);
    git(['update-ref', '-d', `refs/ci-local/pr-${number}`], REPO);
  };

  if (DRY) {
    return { cwd: dir, gitDir: null, meta, behind, planned: true, cleanup };
  }

  fs.mkdirSync(path.dirname(dir), { recursive: true });
  if (fs.existsSync(dir)) git(['worktree', 'remove', '--force', dir], REPO);
  const add = git(['worktree', 'add', '--detach', dir, `refs/ci-local/pr-${number}`], REPO);
  if (add.status !== 0) throw new Error(`worktree add failed: ${add.stderr.trim()}`);

  for (const envFile of ['.env', '.env.tools', 'apps/portal/.env']) {
    const src = path.join(REPO, envFile);
    const dst = path.join(dir, envFile);
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.symlinkSync(src, dst);
    }
  }
  const gitDir = git(['rev-parse', '--git-common-dir'], dir).stdout.trim();
  return { cwd: dir, gitDir: path.resolve(dir, gitDir), meta, behind, cleanup };
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

function main() {
  if (arg('help')) {
    console.log(HELP);
    return 0;
  }
  const lines = [];
  const log = (s) => {
    lines.push(s);
    console.log(s);
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const jobsToRun = (arg('jobs') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let ctx = { cwd: REPO, gitDir: null, mode: 'checkout', ref: 'HEAD' };
  let worktree = null;
  if (arg('pr')) {
    worktree = prWorktree(arg('pr'));
    ctx = {
      cwd: worktree.cwd,
      gitDir: worktree.gitDir,
      mode: 'pr',
      ref: `refs/ci-local/pr-${arg('pr')}`,
    };
    log(`PR #${arg('pr')}  ${worktree.meta.title}`);
    log(
      `  branch ${worktree.meta.headRefName} -> ${worktree.meta.baseRefName}, worktree ${worktree.cwd}${worktree.planned ? ' (not created: dry run)' : ''}`
    );
    log(`  ${worktree.behind} commit(s) on ${worktree.meta.baseRefName} since this branch was cut`);
  } else {
    const head = git(['rev-parse', '--short', 'HEAD'], REPO).stdout.trim();
    const dirty = git(['status', '--porcelain'], REPO).stdout.trim();
    ctx.ref = head;
    log(
      `checkout ${head}${dirty ? ` (${dirty.split('\n').length} uncommitted paths, included in what is tested)` : ' (clean)'}`
    );
  }

  const workflowJobs = GATE_WORKFLOWS.flatMap((f) =>
    parseWorkflow(f).map((job) => ({ ...job, file: f }))
  );
  log(`parsed ${workflowJobs.length} jobs from ${GATE_WORKFLOWS.join(', ')}`);

  let installNote = 'skipped: reusing the checkout that is already installed';
  if (worktree) {
    installNote = arg('no-install') ? 'skipped: --no-install' : 'ran once before the jobs';
  }
  if (installNote === 'ran once before the jobs' && !DRY) {
    log('');
    log(`── install (${path.relative(REPO, worktree.cwd)})`);
    const install = run(['pnpm', 'install', '--frozen-lockfile'], worktree.cwd, {});
    if (install.status === 'FAIL') {
      log(`  install FAIL: ${(install.err || install.out || '').split('\n').slice(-4).join(' ')}`);
      worktree.cleanup();
      return 1;
    }
    log('  install PASS');
  }

  const stopRedis = SUITE === 'full' && arg('redis') !== 'off' ? ensureRedis(log) : null;
  if (stopRedis === null && SUITE === 'full')
    log('redis-backed steps will FAIL unless an instance is reachable');

  const results = [];
  const missing = [];
  for (const job of workflowJobs) {
    if (jobsToRun.length && !jobsToRun.includes(job.key)) continue;
    log('');
    log(
      `── ${job.key}${job.display && job.display !== job.key ? ` (${job.display})` : ''}  [${job.file}]`
    );
    const rows = [];
    for (const step of job.steps) {
      const c = classify(job.key, step);
      if (c.kind === 'plumbing') {
        rows.push({ label: stepLabel(step), status: 'SETUP', detail: 'CI runner plumbing' });
        continue;
      }
      if (c.kind === 'install') {
        rows.push({ label: stepLabel(step), status: 'SETUP', detail: installNote });
        continue;
      }
      if (c.kind === 'github') {
        rows.push({
          label: stepLabel(step),
          status: 'GITHUB',
          detail: c.bootstrap ? `${c.uses} (runner bootstrap)` : c.uses,
        });
        if (!c.bootstrap) missing.push(`${job.key} :: ${stepLabel(step)} (${c.uses})`);
        continue;
      }
      if (c.kind === 'unmapped') {
        rows.push({ label: stepLabel(step), status: 'UNMAPPED', detail: c.detail });
        missing.push(`${job.key} :: ${stepLabel(step)} (no local plan)`);
        continue;
      }
      const plan = c.plan;
      if (plan.suite !== 'core' && SUITE !== 'full') {
        rows.push({
          label: stepLabel(step),
          status: 'SUITE',
          detail: `${plan.suite} only`,
        });
        continue;
      }
      const unavailable = (plan.needs || []).filter((t) => {
        if (t === 'redis') return !redisReachable();
        if (t === 'postgres')
          return spawnSync('pg_isready', ['-q'], { stdio: 'ignore' }).status !== 0;
        if (t === 'playwright')
          return (
            !has('playwright') &&
            !fs.existsSync(path.join(ctx.cwd, 'node_modules', '.bin', 'playwright'))
          );
        return !has(t);
      });
      if (unavailable.length) {
        rows.push({
          label: stepLabel(step),
          status: 'SKIP',
          detail: `needs ${unavailable.join(', ')}`,
        });
        missing.push(`${job.key} :: ${stepLabel(step)} (needs ${unavailable.join(', ')})`);
        continue;
      }
      const built = plan.build ? plan.build(ctx) : [plan.cmd];
      const invocations = typeof built[0] === 'string' ? [built] : built;
      let status = 'PASS';
      let detail = plan.note || '';
      let output = '';
      for (const argv of invocations) {
        const r = run(argv, path.resolve(ctx.cwd, plan.wd || '.'), plan.env || {});
        if (r.status === 'PLAN') {
          status = 'PLAN';
          detail = r.cmd;
          continue;
        }
        if (r.status === 'FAIL') {
          status = 'FAIL';
          const tail = (r.out || r.err || '').trim().split('\n').slice(-6).join('\n         ');
          detail =
            (plan.note ? `${plan.note}\n         ` : '') +
            `${r.cmd} → exit ${r.code}\n         ${tail}`;
          output = `${r.cmd}\n${r.out || ''}\n${r.err || ''}`.slice(0, 4000);
          break;
        }
      }
      if (status === 'FAIL' && plan.soft) {
        status = 'WARN';
        detail = `soft: ${plan.note || 'local environment parity only'} — ${detail.split('\n')[0]}`;
      }
      rows.push({ label: stepLabel(step), status, detail, ...(output ? { output } : {}) });
    }
    const width = Math.max(...rows.map((r) => r.label.length), 20);
    for (const r of rows) {
      const mark = {
        PASS: 'ok  ',
        PLAN: 'plan',
        WARN: 'warn',
        FAIL: 'FAIL',
        SKIP: 'skip',
        GITHUB: 'gh—',
        UNMAPPED: 'unmp',
        SUITE: 'full',
        SETUP: 'set ',
      }[r.status];
      log(
        `   [${mark}] ${r.label.padEnd(width)}${r.detail ? `  ${String(r.detail).split('\n')[0]}` : ''}`
      );
      if (r.status === 'FAIL' && String(r.detail).includes('\n'))
        log(String(r.detail).split('\n').slice(1).join('\n').replace(/\n/g, '\n   '));
    }
    results.push({
      job: job.key,
      file: job.file,
      steps: rows,
      failed: rows.some((r) => r.status === 'FAIL'),
    });
  }

  if (stopRedis) stopRedis();
  if (worktree) worktree.cleanup();

  const failed = results.filter((r) => r.failed);
  log('');
  log(`── summary: ${results.length} jobs, ${failed.length} failing`);
  for (const r of failed) log(`   FAIL ${r.job}`);
  if (missing.length) {
    log('');
    log(
      `── not covered locally (${missing.length} steps — these stay unchecked until Actions runs)`
    );
    for (const m of [...new Set(missing)]) log(`   - ${m}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: ctx.mode,
    ref: ctx.ref,
    pr: arg('pr') || null,
    suite: SUITE,
    node: process.versions.node,
    jobs: results,
    uncovered: [...new Set(missing)],
    exitCode: failed.length ? 1 : 0,
  };
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  fs.writeFileSync(
    path.join(REPORT_DIR, `report-${stamp}.json`),
    `${JSON.stringify(report, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(REPORT_DIR, 'report-latest.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  log('');
  log(`report: ${path.join(REPORT_DIR, 'report-latest.json')}`);
  return report.exitCode;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`local-ci error: ${err.message}`);
  process.exit(2);
}
