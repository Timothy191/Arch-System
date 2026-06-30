/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-07_toolchain_configuration/library.js"],
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
