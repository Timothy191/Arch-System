// This configuration only applies to the package manager root.
/** @type {import("eslint").Linter.Config} */
module.exports = {
  ignorePatterns: ["apps/**", "packages/**", "e2e/**", "playwright.config.ts"],
  extends: ["@repo/eslint-config/library.js", require.resolve("./eslint.boundaries.cjs")],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
};
