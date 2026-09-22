#!/usr/bin/env node

/**
 * @fileoverview Unified Compound Engineering & Swarm Flow Runner
 * Executes the compound lifecycle stages: Research -> Plan -> Swarm -> Work -> Simplify -> Review -> Verify
 */

const { execSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const prompt = process.argv.slice(2).join(" ").trim() || "Automated Compound Engineering Cycle";

console.log("⚡ ========================================================");
console.log("   UNIFIED COMPOUND ENGINEERING & SWARMING PIPELINE");
console.log(`   Task: "${prompt}"`);
console.log("========================================================\n");

// Stage 1: Spec Breakdown
console.log("▶ Stage 1/5: EARS Spec Decomposition...");
execSync(`node tools/scripts/spec-breakdown-engine.cjs "${prompt}"`, {
  cwd: ROOT,
  stdio: "inherit",
});

// Stage 2: Dispatch Routing
console.log("▶ Stage 2/5: Auto-Dispatch Routing...");
execSync(`node tools/scripts/auto-dispatch-router.cjs "${prompt}"`, {
  cwd: ROOT,
  stdio: "inherit",
});

// Stage 3: Swarm Audit & Validation
console.log("▶ Stage 3/5: Swarm Audit...");
execSync(`node tools/scripts/run-swarm.cjs`, { cwd: ROOT, stdio: "inherit" });

// Stage 4: Smart Memory Indexing
console.log("▶ Stage 4/5: Smart Memory Indexing...");
execSync(`node tools/scripts/smart-indexer.cjs`, { cwd: ROOT, stdio: "inherit" });

console.log("\n✅ Stage 5/5: Compound Cycle Orchestration Complete.\n");
