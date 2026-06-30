/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: ["public/", "coverage/"],
  extends: ["@repo/eslint-07_toolchain_configuration/next.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
  overrides: [
    {
      files: ["03_operations_automation/*.js"],
      env: { node: true },
      parserOptions: {
        project: null,
      },
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/setupTests.ts"],
      env: { jest: true },
    },
    {
      files: ["lib/env.ts"],
      rules: {
        "no-restricted-imports": "off",
      },
    },
  ],
};
