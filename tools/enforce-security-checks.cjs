#!/usr/bin/env node

/**
 * @fileoverview Enforces critical security checks across the codebase to prevent vulnerabilities.
 * Usage: node tools/enforce-security-checks.cjs [--ci]
 */
/**
 * Security Checks Enforcer
 *
 * Runs the regex patterns defined in tools/policy/security.checks.json against
 * the codebase to prevent common vulnerabilities (eval, sql concat, secrets).
 *
 * Usage: node tools/enforce-security-checks.cjs [--ci]
 */

const fs = require("fs");
const path = require("path");
let globSync;
try {
  // glob v9+ uses globSync, v8 uses glob.sync
  const glob = require("glob");
  globSync = glob.globSync || glob.sync;
} catch (e) {
  console.error("❌ 'glob' package not found. Run pnpm install.");
  process.exit(1);
}

const POLICY_PATH = path.join(__dirname, "policy", "security.checks.json");
const REPO_ROOT = path.resolve(__dirname, "..");

if (!fs.existsSync(POLICY_PATH)) {
  console.error(`❌ Policy file not found: ${POLICY_PATH}`);
  console.error("Run 'pnpm policy:gen' first.");
  process.exit(1);
}

const policyData = JSON.parse(fs.readFileSync(POLICY_PATH, "utf-8"));
const checks = policyData.checks || [];

const isCI = process.argv.includes("--ci");
const currentEnv = isCI ? "ci" : "local";

let hasErrors = false;
let warningCount = 0;

console.log(`\n🛡️  Running Security Checks (Env: ${currentEnv})...\n`);

for (const check of checks) {
  if (!check.enforceAt.includes(currentEnv)) {
    continue; // Skip checks not meant for this environment
  }

  const regex = new RegExp(check.pattern, "g");

  let filesToScan = [];
  for (const globPattern of check.paths) {
    const matched = globSync(globPattern, {
      cwd: REPO_ROOT,
      absolute: true,
      nodir: true,
      ignore: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.nx/**"],
    });
    filesToScan = filesToScan.concat(matched);
  }

  for (const file of filesToScan) {
    // Skip checking this script itself and the policy compiler
    if (
      file.endsWith("tools/enforce-security-checks.cjs") ||
      file.endsWith("tools/policy-compiler.cjs")
    ) {
      continue;
    }

    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        // Exclude lines that are just comments (very basic check)
        if (line.trim().startsWith("//") || line.trim().startsWith("*")) {
          continue;
        }

        const relativePath = path.relative(REPO_ROOT, file);
        const symbol = check.severity === "error" ? "❌" : "⚠️";
        console.log(`${symbol} [${check.id}] ${check.rule}`);
        console.log(`   File: ${relativePath}:${i + 1}`);
        console.log(`   Line: ${line.trim()}\n`);

        if (check.severity === "error") {
          hasErrors = true;
        } else {
          warningCount++;
        }
      }
      regex.lastIndex = 0; // reset regex state
    }
  }
}

if (hasErrors) {
  console.error(`\n🔴 Security audit failed! Critical vulnerabilities found.`);
  process.exit(1);
}

if (warningCount > 0) {
  console.log(`\n🟡 Security audit passed with ${warningCount} warnings.`);
} else {
  console.log(`\n✅ Security audit passed. No violations found.`);
}
