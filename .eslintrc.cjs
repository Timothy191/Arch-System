// This configuration only applies to the package manager root.
/** @type {import("eslint").Linter.Config} */
module.exports = {
  // Each app/package has its own config with framework-specific rules (Next.js, React, etc.)
  // This prevents root config from interfering with app-level configurations
  ignorePatterns: ["apps/**", "packages/**", "e2e/**", "playwright.config.ts", "k6/**"],
  extends: [
    "@repo/eslint-config/library.js",
    require.resolve("./config/tools/eslint.boundaries.cjs"),
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
};
