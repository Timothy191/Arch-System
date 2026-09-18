#!/usr/bin/env node
/**
 * @fileoverview Deterministic classifier for uncommitted files into action buckets.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = "/home/tim/Projects/Next.js-Monorepo-Business-Portal";

function getModifiedFiles() {
  const stdout = execSync("git status --short", { cwd: REPO_ROOT, encoding: "utf8" });
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/"/g, ""));
}

function isTestFile(f) {
  return /\.(test|spec)\.(ts|tsx|js|jsx|cjs|mjs)$/.test(f) || /\/__tests__\//.test(f);
}

function isSourceFile(f) {
  return /\.(ts|tsx|js|jsx|cjs|mjs)$/.test(f) && !isTestFile(f);
}

function isAuthSensitive(f) {
  return /\/(auth)\//.test(f) || /features\/auth/.test(f) || /features\/admin/.test(f) || /app\/admin/.test(f);
}

function isApiSensitive(f) {
  return /app\/api\//.test(f) || /webhook/.test(f) || /server\//.test(f) || /proxy/.test(f);
}

function isDeploySensitive(f) {
  return /scripts\/deploy/.test(f) || /scripts\/dev\.sh/.test(f) || /next\.config/.test(f) || /Dockerfile/.test(f) || /\.gitlab-ci\.yml/.test(f);
}

function isJunk(f) {
  const junkPatterns = [
    /^test-dynamic\.js$/,
    /^test_tailwind\.js$/,
    /tests\/__pycache__/,
    /scratch-screenshot/,
    /^patch-goal\.sh$/,
    /^patch-system-tray\.cjs$/,
    /^pps\//,
    /\.pyc$/,
  ];
  return junkPatterns.some((p) => p.test(f));
}

function isGeneratedAsset(f) {
  return /\.(webp|mp4|webm|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$/.test(f);
}

function isDocs(f) {
  return /\.(md|mdx)$/.test(f) || /^docs\//.test(f) || /^documentation\//.test(f);
}

function isConfig(f) {
  return /\.(json|yaml|yml|toml)$/.test(f) || /\.config\./.test(f) || /package\.json$/.test(f) || /pnpm-(lock|workspace)\.yaml$/.test(f);
}

function classify(files) {
  const buckets = {
    revert: [],
    manual_review: [],
    needs_tests: [],
    safe_commit: [],
    assets: [],
  };

  for (const f of files) {
    if (isJunk(f)) {
      buckets.revert.push(f);
      continue;
    }

    if (isGeneratedAsset(f)) {
      buckets.assets.push(f);
      continue;
    }

    if (isDeploySensitive(f)) {
      buckets.manual_review.push(f);
      continue;
    }

    if (isAuthSensitive(f) || isApiSensitive(f)) {
      buckets.manual_review.push(f);
      continue;
    }

    if (isSourceFile(f)) {
      buckets.needs_tests.push(f);
      continue;
    }

    if (isTestFile(f) || isDocs(f) || isConfig(f)) {
      buckets.safe_commit.push(f);
      continue;
    }

    // Directories and remaining files
    if (f.endsWith("/")) {
      buckets.safe_commit.push(f);
    } else {
      buckets.manual_review.push(f);
    }
  }

  return buckets;
}

function main() {
  const files = getModifiedFiles();
  const buckets = classify(files);
  const plan = {
    repo: REPO_ROOT,
    branch: execSync("git branch --show-current", { cwd: REPO_ROOT, encoding: "utf8" }).trim(),
    total_files: files.length,
    buckets,
    generated_at: new Date().toISOString(),
  };

  const outPath = path.join(REPO_ROOT, "temp", "worktree-classification.json");
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(plan, null, 2));
}

main();
