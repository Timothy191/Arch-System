#!/usr/bin/env node

/**
 * @fileoverview Auto-tags Nx projects with scope tags based on directory location.
 * Usage: node tools/apply-project-tags.cjs
 */
//
// Tag every Nx project with its scope:* tag based on path.
// See tools/policy-compiler.cjs for the canonical tag vocabulary.
//
// Tag Vocabulary:
// - scope:app - All applications in apps/
// - scope:app:<name> - Specific app (e.g., scope:app:portal)
// - scope:package - All packages in packages/
// - scope:package:<name> - Specific package (e.g., scope:package:ui)
// - scope:package:db - Database package (architectural significance)
// - scope:package:db-internal - Database internals (restricted access)
// - scope:tool - Build-time tools in tools/
//
// Tools Subdirectory Handling:
// Only specific tools subdirectories are tagged as they contain build-time scripts:
// - wiki-viewer - Documentation viewer
// - n8n-mcp - n8n MCP server integration
// - preflight-mcp - Preflight MCP server integration
// - policy - Policy compilation and enforcement
// Other tools/ subdirectories are excluded as they may contain transient files or utilities
// that don't require Nx project tagging.
//
// Usage: node tools/apply-project-tags.cjs
// Run this after adding new projects or when project structure changes.
//

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const APPS_DIR = path.join(ROOT, "apps");
const PACKAGES_DIR = path.join(ROOT, "packages");
const TOOLS_DIR = path.join(ROOT, "tools");

// Explicitly tagged tools subdirectories (build-time scripts requiring Nx integration)
const TAGGED_TOOLS = ["wiki-viewer", "n8n-mcp", "preflight-mcp", "policy"];

/**
 * Derives scope tags for an Nx project based on its path.
 *
 * @param {string} projectName - The name of the project.
 * @param {string} projectPath - The relative path of the project.
 * @returns {string[]} An array of tags derived for the project.
 */
function deriveTags(projectName, projectPath) {
  const tags = new Set();
  if (projectPath.startsWith("apps/")) {
    tags.add("scope:app");
    const name = projectName.replace(/^@?[a-z0-9-]*\//, "");
    tags.add("scope:app:" + name);
  } else if (projectPath.startsWith("packages/")) {
    tags.add("scope:package");
    const name = projectName.replace(/^@?[a-z0-9-]*\//, "");
    tags.add("scope:package:" + name);
    if (name === "database") {
      tags.add("scope:package:db");
      tags.add("scope:package:db-internal");
    }
  } else if (projectPath.startsWith("tools/")) {
    tags.add("scope:tool");
  }
  return Array.from(tags);
}

/**
 * Ensures that the project.json config file exists and contains the appropriate scope tags.
 *
 * @param {string} projectName - The name of the project.
 * @param {string} projectPath - The relative path of the project.
 * @returns {{projectJsonPath: string, projectConfig: object} | null} The project path and parsed config, or null on error.
 */
function ensureProjectJson(projectName, projectPath) {
  const projectJsonPath = path.join(ROOT, projectPath, "project.json");
  let projectConfig;

  if (fs.existsSync(projectJsonPath)) {
    try {
      projectConfig = JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
    } catch (error) {
      console.error(`Error parsing ${projectJsonPath}:`, error.message);
      return null;
    }
  } else {
    const pkgPath = path.join(ROOT, projectPath, "package.json");
    if (!fs.existsSync(pkgPath)) return null;

    try {
      const pkgConfig = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      projectConfig = { name: pkgConfig.name || projectName };
    } catch (error) {
      console.error(`Error parsing ${pkgPath}:`, error.message);
      return null;
    }
  }

  const existingTags = new Set(projectConfig.tags || []);
  for (const t of deriveTags(projectName, projectPath)) existingTags.add(t);
  projectConfig.tags = Array.from(existingTags);
  return { projectJsonPath, projectConfig };
}

const targets = [];
for (const n of fs.readdirSync(APPS_DIR)) {
  targets.push({ name: n, p: path.join("apps", n) });
}
for (const n of fs.readdirSync(PACKAGES_DIR)) {
  targets.push({ name: n, p: path.join("packages", n) });
}
// Recursively scan packages/features/*/* for feature-sliced packages
const featuresDir = path.join(PACKAGES_DIR, "features");
if (fs.existsSync(featuresDir)) {
  for (const feature of fs.readdirSync(featuresDir)) {
    const featurePath = path.join(featuresDir, feature);
    if (fs.statSync(featurePath).isDirectory()) {
      for (const subPkg of fs.readdirSync(featurePath)) {
        const subPkgPath = path.join(featurePath, subPkg);
        if (fs.statSync(subPkgPath).isDirectory()) {
          targets.push({ name: subPkg, p: path.join("packages", "features", feature, subPkg) });
        }
      }
    }
  }
}
if (fs.existsSync(TOOLS_DIR)) {
  for (const n of fs.readdirSync(TOOLS_DIR)) {
    if (TAGGED_TOOLS.includes(n)) {
      targets.push({ name: n, p: path.join("tools", n) });
    }
  }
}

let written = 0;
let skipped = 0;

for (const { p: relPath } of targets) {
  const projectJsonPath = path.join(ROOT, relPath, "project.json");
  const pkgPath = path.join(ROOT, relPath, "package.json");
  const hasProjectJson = fs.existsSync(projectJsonPath);
  const hasPackageJson = fs.existsSync(pkgPath);
  if (!hasProjectJson && !hasPackageJson) {
    skipped++;
    continue;
  }

  let projectName;
  try {
    if (hasProjectJson) {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
      projectName = projectJson.name;
    } else {
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      projectName = pkgJson.name;
    }
  } catch (error) {
    console.error(`Error reading project name from ${relPath}:`, error.message);
    skipped++;
    continue;
  }

  const result = ensureProjectJson(projectName, relPath);
  if (!result) {
    skipped++;
    continue;
  }
  fs.writeFileSync(result.projectJsonPath, JSON.stringify(result.projectConfig, null, 2) + "\n");
  written++;
  console.log("OK " + relPath + " -> tags: " + result.projectConfig.tags.join(", "));
}

console.log("\nDone. " + written + " project.json files written, " + skipped + " skipped.");
