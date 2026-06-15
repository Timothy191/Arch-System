#!/usr/bin/env node
//
// Tag every Nx project with its scope:* tag based on path.
// See tools/policy-compiler.cjs for the canonical tag vocabulary.
//

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const APPS_DIR = path.join(ROOT, "apps");
const PACKAGES_DIR = path.join(ROOT, "packages");
const TOOLS_DIR = path.join(ROOT, "tools");

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

function ensureProjectJson(projectName, projectPath) {
  const projectJsonPath = path.join(ROOT, projectPath, "project.json");
  let projectConfig;
  if (fs.existsSync(projectJsonPath)) {
    projectConfig = JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
  } else {
    const pkgPath = path.join(ROOT, projectPath, "package.json");
    if (!fs.existsSync(pkgPath)) return null;
    projectConfig = { name: projectName };
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
if (fs.existsSync(TOOLS_DIR)) {
  for (const n of fs.readdirSync(TOOLS_DIR)) {
    if (["wiki-viewer", "n8n-mcp", "preflight-mcp", "policy"].includes(n)) {
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

  const projectName = hasProjectJson
    ? JSON.parse(fs.readFileSync(projectJsonPath, "utf-8")).name
    : require(pkgPath).name;

  const result = ensureProjectJson(projectName, relPath);
  if (!result) {
    skipped++;
    continue;
  }
  fs.writeFileSync(
    result.projectJsonPath,
    JSON.stringify(result.projectConfig, null, 2) + "\n",
  );
  written++;
  console.log(
    "OK " + relPath + " -> tags: " + result.projectConfig.tags.join(", "),
  );
}

console.log(
  "\nDone. " +
    written +
    " project.json files written, " +
    skipped +
    " skipped.",
);
