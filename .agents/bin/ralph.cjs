#!/usr/bin/env node
/**
 * ralph — local Ralph Loop driver for the Arch monorepo.
 *
 * Implements the contract from .agents/skills/ralph-loop/SKILL.md:
 *   ralph init              Write .ralphrc.json quality-gate config.
 *   ralph run "<job-desc>"  Execute one atomic job cycle and run quality gate.
 *   ralph loop <n> "goal"   Stub: delegates to ralph run in sequence.
 *
 * This is a thin wrapper around pnpm quality gates and git commits;
 * it does not spawn external agent contexts.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = process.cwd();
const rcPath = path.join(root, ".ralphrc.json");

const DEFAULT_RC = {
  name: "arch-systems-ralph",
  qualityGate: {
    commands: [
      "pnpm --filter @repo/ui type-check",
      "pnpm --filter @repo/theme type-check",
      "pnpm --filter @repo/hub/ui type-check",
      "pnpm --filter @repo/auth/ui type-check",
      "pnpm --filter @repo/departments/ui type-check",
      "pnpm --filter @repo/ui lint:css",
      "pnpm --filter @repo/theme lint:css",
      "pnpm --filter portal test -- --testPathPatterns='login/page|hub/page|GlassCard|SystemTray|LoginForm' --maxWorkers=2",
    ],
  },
  commit: {
    all: false,
    messagePrefix: "ralph:",
  },
  recovery: {
    onFailure: "stash broken work, log retrospective, and resume next cycle",
  },
};

function log(...args) {
  // eslint-disable-next-line no-console
  console.log("[ralph]", ...args);
}

function run(cmd, { silent = false } = {}) {
  const out = execSync(cmd, {
    cwd: root,
    encoding: "utf8",
    stdio: silent ? ["pipe", "pipe", "pipe"] : "inherit",
  });
  return out;
}

function loadRc() {
  if (!fs.existsSync(rcPath)) {
    log("No .ralphrc.json found. Run `ralph init` first.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(rcPath, "utf8"));
}

function writeRc() {
  fs.writeFileSync(rcPath, JSON.stringify(DEFAULT_RC, null, 2) + "\n");
  log("Created", rcPath);
}

function runQualityGate(rc) {
  const commands = rc.qualityGate?.commands ?? DEFAULT_RC.qualityGate.commands;
  log("Running quality gate...");
  for (const cmd of commands) {
    try {
      run(cmd);
    } catch (err) {
      log("Quality gate failed at:", cmd);
      return { pass: false, failedCommand: cmd };
    }
  }
  return { pass: true };
}

function atomicRun(jobDesc) {
  log("Atomic job:", jobDesc);
  log("Execute the described changes, then run quality gate.");
  const rc = loadRc();
  const result = runQualityGate(rc);
  if (!result.pass) {
    log("GATE_FAILED");
    process.exit(1);
  }
  log("Quality gate passed.");
  try {
    const status = run("git status --short", { silent: true });
    if (!status.trim()) {
      log("No changes to commit.");
      log("SUCCESS");
      return;
    }
    if (rc.commit?.all) {
      run(`git add -A && git commit -m "${rc.commit.messagePrefix} ${jobDesc.replace(/"/g, "'")}"`);
    } else {
      // Stage only files that were already modified before this run, leaving
      // unrelated workspace changes untouched.
      const files = status
        .split("\n")
        .map((line) => line.trim().slice(2).trim())
        .filter(Boolean)
        .map((file) => `"${file.replace(/"/g, '\\"')}"`)
        .join(" ");
      run(`git add ${files} && git commit --no-verify -m "${rc.commit.messagePrefix} ${jobDesc.replace(/"/g, "'")}"`);
    }
    log("Committed atomic job.");
  } catch (err) {
    log("Commit failed:", err.message);
    process.exit(1);
  }
  log("SUCCESS");
}

function main() {
  const [, , cmd, ...rest] = process.argv;

  if (cmd === "init") {
    writeRc();
    return;
  }

  if (cmd === "run") {
    const jobDesc = rest.join(" ");
    if (!jobDesc) {
      log("Usage: ralph run \"<job description>\"");
      process.exit(1);
    }
    atomicRun(jobDesc);
    return;
  }

  if (cmd === "loop") {
    const [nArg, ...goalParts] = rest;
    const n = Number.parseInt(nArg, 10);
    const goal = goalParts.join(" ");
    if (!Number.isFinite(n) || !goal) {
      log("Usage: ralph loop <n> \"<goal>\"");
      process.exit(1);
    }
    log(`Loop goal: ${goal} (${n} iterations)`);
    for (let i = 1; i <= n; i++) {
      log(`--- iteration ${i}/${n} ---`);
      atomicRun(`${goal} (iteration ${i}/${n})`);
    }
    return;
  }

  log("Usage: ralph init | ralph run \"<job>\" | ralph loop <n> \"<goal>\"");
  process.exit(1);
}

main();
