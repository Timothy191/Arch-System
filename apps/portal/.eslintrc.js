/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: ["public/", "coverage/"],
  extends: ["@repo/eslint-config/next.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
  overrides: [
    {
      files: ["scripts/*.js"],
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
      files: ["lib/env.ts", "lib/ai/tools.ts"],
      rules: {
        "no-restricted-imports": "off",
      },
    },
  ],
};
