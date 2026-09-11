#!/usr/bin/env node

/**
 * Calculates the Real-World Score based on 5 metrics:
 * Feasibility, Maintainability, Security, Performance, and Reliability.
 * Formula: (Feasibility + Maintainability + Security + Performance + Reliability) / 5
 */

function printUsage() {
  console.log("Usage: node tools/real-world-score.cjs <feasibility> <maintainability> <security> <performance> <reliability>");
  console.log("Example: node tools/real-world-score.cjs 95 90 92 88 96");
}

const args = process.argv.slice(2);

if (args.length !== 5) {
  printUsage();
  process.exit(1);
}

const [feasibility, maintainability, security, performance, reliability] = args.map(Number);

if (args.some(arg => isNaN(Number(arg)))) {
  console.error("Error: All arguments must be numbers.");
  printUsage();
  process.exit(1);
}

const score = (feasibility + maintainability + security + performance + reliability) / 5;

console.log(`Real-World Score: ${score.toFixed(2)}/100`);
