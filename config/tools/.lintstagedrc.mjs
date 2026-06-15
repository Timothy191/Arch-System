/**
 * lint-staged configuration
 *
 * Goals:
 * 1. No glob overlap — each staged file hits at most one task set.
 * 2. Secretlint skips .env* templates and files already handled by eslint/prettier.
 * 3. Chunk large file batches to avoid OOM / SIGKILL on constrained systems.
 */

const PRETTIER_GLOBS = ["*.json", "*.md", "*.css", "*.mjs", "*.yaml", "*.yml"];

const ESLINT_GLOBS = ["*.js", "*.ts", "*.tsx"];

const PACKAGE_JSON_GLOB = "package.json";

function matchesAny(filename, patterns) {
  return patterns.some((p) => filename.endsWith(p.slice(1)));
}

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default {
  // package.json → syncpack fix then prettier
  [PACKAGE_JSON_GLOB]: (files) => {
    const filtered = files.filter((f) => f.endsWith(PACKAGE_JSON_GLOB));
    if (filtered.length === 0) return [];
    const commands = [];
    // Run syncpack fix-mismatches for all package.json files at once
    commands.push("pnpm syncpack fix-mismatches --config config/tools/.syncpackrc.js");
    // Then prettier each file
    for (const file of filtered) {
      commands.push(`prettier --write ${file}`);
    }
    return commands;
  },

  // JS/TS → eslint then prettier
  "*.{js,ts,tsx}": (files) => {
    const filtered = files.filter((f) => matchesAny(f, ESLINT_GLOBS));
    if (filtered.length === 0) return [];
    // Process in chunks of 20 to keep memory low
    const commands = [];
    for (const batch of chunk(filtered, 20)) {
      commands.push(`eslint --fix --max-warnings 0 ${batch.join(" ")}`);
      commands.push(`prettier --write ${batch.join(" ")}`);
    }
    return commands;
  },

  // JSON / MD / CSS / YAML → prettier only (excluding package.json which has syncpack)
  "*.{json,md,css,mjs,yaml,yml}": (files) => {
    const filtered = files.filter((f) => matchesAny(f, PRETTIER_GLOBS) && !f.endsWith("package.json"));
    if (filtered.length === 0) return [];
    const commands = [];
    for (const batch of chunk(filtered, 30)) {
      commands.push(`prettier --write ${batch.join(" ")}`);
    }
    return commands;
  },

  // Everything else → secretlint (skip .env*, lockfiles, config files, already-handled exts)
  "*": (files) => {
    const skippedExts = new Set([
      ".js",
      ".ts",
      ".tsx",
      ".json",
      ".md",
      ".css",
      ".mjs",
      ".yaml",
      ".yml",
      ".d.ts",
    ]);
    const skippedNames = new Set([
      ".secretlintignore",
      ".secretlintrc.json",
      ".secretlintrc.js",
      ".secretlintrc.cjs",
      "pnpm-lock.yaml",
      "package-lock.json",
    ]);
    const filtered = files.filter((f) => {
      const base = f.split("/").pop();
      if (base.startsWith(".env")) return false;
      if (skippedNames.has(base)) return false;
      const ext = f.slice(f.lastIndexOf("."));
      return !skippedExts.has(ext);
    });
    if (filtered.length === 0) return [];
    const commands = [];
    for (const batch of chunk(filtered, 30)) {
      commands.push(
        `secretlint --secretlintrc config/tools/.secretlintrc.json --secretlintignore config/tools/.secretlintignore ${batch.join(" ")}`,
      );
    }
    return commands;
  },
};
