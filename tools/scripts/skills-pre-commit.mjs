#!/usr/bin/env node
/**
 * skills-pre-commit — pre-commit guard that blocks commits which would invalidate
 * any STAGED Agent Skill directory (per https://agentskills.io/specification).
 *
 * Walks UP from each staged file and validates directories that contain a `SKILL.md`.
 * Wired from `.husky/pre-commit` after `lint-staged`. Exits 0 (no-op) when:
 *   - no skilled directories are touched by staged files, or
 *   - the validator is unavailable (e.g. CI without `~/.cline/skills-tools`).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const VALIDATOR =
  process.env.SKILL_VALIDATOR || `${process.env.HOME}/.cline/skills-tools/validate-skill.mjs`;

function stagedFiles() {
  try {
    return execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

if (!fs.existsSync(VALIDATOR)) {
  // Lazily skip when the toolkit isn't installed on this host.
  process.exit(0);
}

const files = stagedFiles();
const skillDirs = new Set();

for (const f of files) {
  // Walk up from the staged file until we find a directory containing SKILL.md.
  let dir = path.dirname(f);
  while (dir && dir !== "." && dir !== "/") {
    if (fs.existsSync(path.join(dir, "SKILL.md"))) {
      skillDirs.add(dir);
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

if (skillDirs.size === 0) process.exit(0);

let failed = 0;
for (const d of skillDirs) {
  process.stdout.write(`Skills pre-commit: validating ${d}\n`);
  try {
    execFileSync("node", [VALIDATOR, d], { stdio: "inherit" });
  } catch {
    failed = 1;
  }
}

if (failed !== 0) {
  process.stdout.write(
    "\nSkills pre-commit: skill validation FAILED — fix the FATAL violations above before committing.\n",
  );
  process.stdout.write(`Validator: node ${VALIDATOR} <skill-dir>\n`);
}
process.exit(failed);
