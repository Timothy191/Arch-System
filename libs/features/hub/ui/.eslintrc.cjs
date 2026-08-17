/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-config/react-internal.js"],
  parser: "@typescript-eslint/parser",
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      env: { jest: true },
      rules: {
        "no-redeclare": "off",
      },
    },
    {
      files: ["jest.config.js"],
      env: { node: true },
    },
  ],
};
