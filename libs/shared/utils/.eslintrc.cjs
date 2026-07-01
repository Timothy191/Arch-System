/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-config/library.js"],
  parser: "@typescript-eslint/parser",
  overrides: [
    {
      files: ["src/env.ts"],
      rules: {
        "no-restricted-imports": "off",
      },
    },
  ],
};
