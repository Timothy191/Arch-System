/**
 * lint-staged configuration
 *
 * Goals:
 * 1. No glob overlap — each staged file hits at most one task set.
 * 2. Secretlint skips .env* templates and files already handled by eslint/prettier.
 * 3. Chunk large file batches to avoid OOM / SIGKILL on constrained systems.
 * 4. Run specialized tools (stylelint, theme lint, project tags) where appropriate.
 */

const PRETTIER_GLOBS = ["*.json", "*.css", "*.mjs", "*.yaml", "*.yml"];

const ESLINT_GLOBS = ["*.js", "*.jsx", "*.ts", "*.tsx", "*.cjs", "*.mjs"];

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

  // CSS/SCSS → stylelint then prettier
  "*.{css,scss}": (files) => {
    const filtered = files.filter((f) => f.endsWith(".css") || f.endsWith(".scss"));
    if (filtered.length === 0) return [];
    const commands = [];
    for (const batch of chunk(filtered, 20)) {
      commands.push(`stylelint --fix ${batch.join(" ")}`);
      commands.push(`prettier --write ${batch.join(" ")}`);
    }
    return commands;
  },

  // JS/TS/JSX/CJS/MJS → eslint then prettier
  "*.{js,jsx,ts,tsx,cjs,mjs}": (files) => {
    const filtered = files.filter((f) => {
      const relativePath = f.replace(process.cwd() + "/", "");
      if (!relativePath.includes("/")) return false;
      if (!matchesAny(f, ESLINT_GLOBS)) return false;
      if (f.endsWith("database.types.ts")) return false;
      // Skip files ignored by ESLint (tools, scripts, config, load-tests, scratch, docs, e2e, k6, and dotfiles/dot-directories)
      const pathParts = f.split("/");
      const isIgnored = pathParts.some(
        (part) =>
          part.startsWith(".") ||
          part === "tools" ||
          part === "scripts" ||
          part === "config" ||
          part === "eslint-config" ||
          part === "load-tests" ||
          part === "scratch" ||
          part === "docs" ||
          part === "e2e" ||
          part === "k6",
      );
      return !isIgnored;
    });
    if (filtered.length === 0) return [];
    // Process in chunks of 20 to keep memory low
    const commands = [];
    for (const batch of chunk(filtered, 20)) {
      commands.push(
        `eslint --fix --max-warnings 0 --no-error-on-unmatched-pattern ${batch.join(" ")}`,
      );
      commands.push(`prettier --write ${batch.join(" ")}`);
    }
    return commands;
  },

  // Markdown → markdownlint then prettier
  "*.md": (files) => {
    const filtered = files.filter((f) => f.endsWith(".md"));
    if (filtered.length === 0) return [];
    const commands = [];
    for (const batch of chunk(filtered, 20)) {
      commands.push(
        `markdownlint --config config/tools/.markdownlint.json --fix --ignore node_modules --ignore '**/node_modules' --ignore '**/.next' --ignore '**/dist' ${batch.join(" ")}`,
      );
      commands.push(`prettier --write ${batch.join(" ")}`);
    }
    return commands;
  },

  // JSON / CSS / MJS / YAML / SQL / TOML → prettier only (excluding package.json which has syncpack, and project.json which has its own chain)
  "*.{json,css,mjs,yaml,yml}": (files) => {
    const filtered = files.filter(
      (f) =>
        matchesAny(f, PRETTIER_GLOBS) &&
        !f.endsWith("package.json") &&
        !f.endsWith("project.json") &&
        !f.endsWith(".css") &&
        !f.endsWith(".scss"),
    );
    if (filtered.length === 0) return [];
    const commands = [];
    for (const batch of chunk(filtered, 30)) {
      commands.push(`prettier --write ${batch.join(" ")}`);
    }
    return commands;
  },

  // Theme package → lint:tokens
  "packages/theme/**/*": (files) => {
    if (files.length === 0) return [];
    return ["pnpm --filter @repo/theme lint:tokens"];
  },

  // project.json files → apply project tags then prettier format
  "**/project.json": (files) => {
    if (files.length === 0) return [];
    const commands = ["node tools/apply-project-tags.cjs"];
    for (const batch of chunk(files, 30)) {
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
      ".scss",
      ".mjs",
      ".yaml",
      ".yml",
      ".sql",
      ".toml",
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
