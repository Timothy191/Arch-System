#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_SLUG = process.env.GITHUB_REPOSITORY || 'Timothy191/Arch-System';
const WIKI_ROOT = path.resolve(process.cwd(), 'docs/wiki');
const GOVERNED_SUBDIRS = ['entities', 'concepts', 'comparisons', 'queries'];
const ROOT_WIKI_FILES = ['SCHEMA.md', 'log.md'];
const INIT_WIKI_URL = `https://github.com/${REPO_SLUG}/wiki/_new`;

function parseCliOptions(argv) {
  return {
    isDryRun: argv.includes('--dry-run'),
    outputDir: (() => {
      const idx = argv.indexOf('--out-dir');
      return idx !== -1 && argv[idx + 1] ? path.resolve(argv[idx + 1]) : null;
    })(),
  };
}

function collectMarkdownFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return collectMarkdownFiles(fullPath);
    }
    return entry.name.endsWith('.md') ? [fullPath] : [];
  });
}

function buildSidebarMarkdown() {
  return [
    '### Arch-System Wiki',
    '',
    '- [[Home]]',
    '- [[Arch-Systems (Plantcor)|arch-systems]]',
    '- [[Project Overview & Tech Stack|project-overview]]',
    '- [[Portal Design System|design-system]]',
    '',
    '### Architecture & Stack',
    '',
    '- [[Turborepo Monorepo|turborepo-monorepo]]',
    '- [[Portal App Architecture|portal-app-architecture]]',
    '- [[System Overview|overview]]',
    '- [[Database Schema|database-schema]]',
    '- [[RLS Policy Standards|rls-policy]]',
    '- [[Auth & Middleware|auth-middleware]]',
    '',
    '### Departments',
    '',
    '- [[Control Room|control-room-department]]',
    '- [[Drilling|drilling-department]]',
    '- [[Production|production-department]]',
    '- [[Plant & Processing|plant-processing-department]]',
    '- [[Plant Inventory|plant-inventory-department]]',
    '- [[Access Control|access-control-department]]',
    '- [[Engineering|engineering-department]]',
    '',
    '### Operations & Quality',
    '',
    '- [[Monitoring & Observability|monitoring-error-tracking]]',
    '- [[Deployment Runbook|deployment]]',
    '- [[Testing & QA Strategy|testing-qa-strategy]]',
    '- [[Team Onboarding|onboarding]]',
    '- [[Troubleshooting|troubleshooting]]',
    '- [[Incident Response|incident-response]]',
    '',
  ].join('\n');
}

function buildFooterMarkdown() {
  return [
    '---',
    `**Arch-Systems (Plantcor / Arch OS)** · [Repository](https://github.com/${REPO_SLUG}) · [Production Portal](https://arch-system-kappap.vercel.app) · Synced from \`docs/wiki/\` via \`pnpm wiki:sync\``,
    '',
  ].join('\n');
}

function stageWikiBundle(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  const indexSource = path.join(WIKI_ROOT, 'index.md');
  fs.copyFileSync(indexSource, path.join(targetDir, 'Home.md'));

  for (const rootFile of ROOT_WIKI_FILES) {
    const src = path.join(WIKI_ROOT, rootFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(targetDir, rootFile));
    }
  }

  let copiedCount = 1;
  for (const subdir of GOVERNED_SUBDIRS) {
    const files = collectMarkdownFiles(path.join(WIKI_ROOT, subdir));
    for (const filePath of files) {
      const destName = path.basename(filePath);
      fs.copyFileSync(filePath, path.join(targetDir, destName));
      copiedCount += 1;
    }
  }

  fs.writeFileSync(path.join(targetDir, '_Sidebar.md'), buildSidebarMarkdown(), 'utf8');
  fs.writeFileSync(path.join(targetDir, '_Footer.md'), buildFooterMarkdown(), 'utf8');
  return copiedCount + 2;
}

function resolveGitHubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function isRemoteWikiInitialized(remoteUrl) {
  try {
    execFileSync('git', ['ls-remote', remoteUrl], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function runWikiSync() {
  const options = parseCliOptions(process.argv.slice(2));

  execFileSync('node', [path.resolve(process.cwd(), 'tools/audits/audit-wiki.mjs')], {
    stdio: 'inherit',
  });

  const stagingDir =
    options.outputDir || fs.mkdtempSync(path.join(os.tmpdir(), 'arch-wiki-bundle-'));
  const totalStaged = stageWikiBundle(stagingDir);
  console.log(`📦 [WIKI SYNC] Staged ${totalStaged} wiki files into ${stagingDir}`);

  if (options.isDryRun) {
    console.log('✅ [WIKI SYNC] Dry-run complete (skipped remote git push).');
    return;
  }

  const token = resolveGitHubToken();
  const remoteUrl = token
    ? `https://x-access-token:${token}@github.com/${REPO_SLUG}.wiki.git`
    : `https://github.com/${REPO_SLUG}.wiki.git`;

  if (!isRemoteWikiInitialized(remoteUrl)) {
    console.log(
      `ℹ️  [WIKI SYNC] Remote wiki repository (${REPO_SLUG}.wiki.git) is not initialized yet.`
    );
    console.log(
      `   To initialize once (GitHub requires 1 web click to create the backing git repo):`
    );
    console.log(`   1. Open ${INIT_WIKI_URL}`);
    console.log(`   2. Click "Save Page" on the default Home page.`);
    console.log(`   3. Re-run: pnpm wiki:sync`);
    return;
  }

  const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-gh-wiki-clone-'));
  try {
    execFileSync('git', ['clone', '--depth', '1', remoteUrl, cloneDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const fileName of fs.readdirSync(stagingDir)) {
      fs.copyFileSync(path.join(stagingDir, fileName), path.join(cloneDir, fileName));
    }

    execFileSync('git', ['config', 'user.name', 'Arch-System Wiki Sync'], { cwd: cloneDir });
    execFileSync('git', ['config', 'user.email', 'noreply@arch.os'], { cwd: cloneDir });
    execFileSync('git', ['add', '-A'], { cwd: cloneDir });

    const statusOut = execFileSync('git', ['status', '--porcelain'], {
      cwd: cloneDir,
      encoding: 'utf8',
    }).trim();

    if (!statusOut) {
      console.log('✅ [WIKI SYNC] GitHub Wiki is already up to date.');
      return;
    }

    const headSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    execFileSync(
      'git',
      ['commit', '--no-verify', '-m', `docs(wiki): sync governed wiki (${headSha})`],
      {
        cwd: cloneDir,
        stdio: 'inherit',
      }
    );
    execFileSync('git', ['push', '--no-verify', 'origin', 'HEAD'], {
      cwd: cloneDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(`✅ [WIKI SYNC] Published ${totalStaged} files to ${REPO_SLUG}.wiki.git.`);
  } finally {
    fs.rmSync(cloneDir, { recursive: true, force: true });
  }
}

runWikiSync();
