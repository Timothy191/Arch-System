// This configuration only applies to the package manager root.
/** @type {import("eslint").Linter.Config} */
module.exports = {
  // Apps and packages extend this configuration.
  ignorePatterns: ["apps/**", "packages/**", "e2e/**", "playwright.config.ts", "k6/**", "docs/**"],
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  extends: [
    "@repo/eslint-config/library.js",
    require.resolve("./config/tools/eslint.boundaries.cjs"),
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
};
