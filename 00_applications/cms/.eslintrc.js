/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: ["public/", "coverage/", "03_operations_automation/"],
  extends: ["@repo/eslint-07_toolchain_configuration/next.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
};
