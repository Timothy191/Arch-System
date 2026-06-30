/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-07_toolchain_configuration/library.js"],
  parser: "@typescript-eslint/parser",
  ignorePatterns: ["src/database.types.ts"],
  env: { browser: true, node: true },
};
